#!/usr/bin/env bash
# WAPALA "host" deploy script — dijalankan DI SERVER VPS.
# Dipanggil otomatis oleh .github/workflows/deploy-host.yml (via SSH, bash -s),
# atau manual: WAPALA_REPO_URL=... WAPALA_BRANCH=host bash deploy/host-deploy.sh
#
# Alur: clone release baru -> npm ci + build hemat memori -> migrate ->
# switch symlink atomik -> restart service -> health check -> rollback bila gagal.
#
# Semua konfigurasi lewat environment (nilai default aman untuk 2 GB VPS):
#   WAPALA_REPO_URL         (wajib) URL git repository
#   WAPALA_BRANCH           (default host) branch yang dideploy
#   WAPALA_BASE_DIR         (default /srv/wapala)
#   WAPALA_SERVICE          (default wapala) nama unit systemd
#   WAPALA_USER             (default wapala) user pemilik release/runtime
#   WAPALA_ENV_FILE         (default /etc/wapala/production.env) shell-compatible
#   WAPALA_KEEP_RELEASES    (default 3)
#   WAPALA_HEAP_CI          (default 512) MB heap saat npm ci
#   WAPALA_HEAP_BUILD       (default 768) MB heap saat next build
#   WAPALA_SKIP_MIGRATE     (default 0) set 1 untuk lewati migrate
#   WAPALA_SKIP_RESTART     (default 0) set 1 untuk lewati restart/health check
#   WAPALA_MIN_DISK_MB      (default 2048)
#   WAPALA_BACKUP_CMD       (opsional) perintah backup yang dijalankan sebelum migrate

set -Eeuo pipefail

WAPALA_BRANCH="${WAPALA_BRANCH:-host}"
WAPALA_BASE_DIR="${WAPALA_BASE_DIR:-/srv/wapala}"
WAPALA_SERVICE="${WAPALA_SERVICE:-wapala}"
WAPALA_USER="${WAPALA_USER:-wapala}"
WAPALA_ENV_FILE="${WAPALA_ENV_FILE:-/etc/wapala/production.env}"
WAPALA_KEEP_RELEASES="${WAPALA_KEEP_RELEASES:-3}"
WAPALA_HEAP_CI="${WAPALA_HEAP_CI:-512}"
WAPALA_HEAP_BUILD="${WAPALA_HEAP_BUILD:-768}"
WAPALA_SKIP_MIGRATE="${WAPALA_SKIP_MIGRATE:-0}"
WAPALA_SKIP_RESTART="${WAPALA_SKIP_RESTART:-0}"
WAPALA_MIN_DISK_MB="${WAPALA_MIN_DISK_MB:-2048}"
WAPALA_HEALTH_TRIES="${WAPALA_HEALTH_TRIES:-30}"

RELEASES_DIR="$WAPALA_BASE_DIR/releases"
CURRENT_LINK="$WAPALA_BASE_DIR/current"
RELEASE_ID="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
CACHE_DIR="$(mktemp -d /var/tmp/wapala-npm-cache.XXXXXX)"

log() { printf '[wapala-deploy] %s\n' "$*"; }
die() { printf '[wapala-deploy] ERROR: %s\n' "$*" >&2; exit 1; }
cleanup() { rm -rf "$CACHE_DIR"; }
trap cleanup EXIT

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

# ---------- Preflight ----------
[ -n "${WAPALA_REPO_URL:-}" ] || die "WAPALA_REPO_URL wajib diisi."
command -v git >/dev/null || die "git tidak ditemukan."
command -v node >/dev/null || die "node tidak ditemukan."
command -v npm >/dev/null || die "npm tidak ditemukan."
[ -f "$WAPALA_ENV_FILE" ] || die "Env file $WAPALA_ENV_FILE tidak ada. Jalankan provisioning dulu."

available_mb="$(df -Pm "$WAPALA_BASE_DIR" | awk 'NR==2 {print $4}')"
[ "$available_mb" -ge "$WAPALA_MIN_DISK_MB" ] ||
  die "Ruang disk kurang: ${available_mb}MB tersedia, butuh >= ${WAPALA_MIN_DISK_MB}MB."

log "Deploy branch=$WAPALA_BRANCH release=$RELEASE_ID"

# ---------- Clone release baru ----------
mkdir -p "$RELEASES_DIR"
git clone --depth 1 --branch "$WAPALA_BRANCH" --single-branch \
  "$WAPALA_REPO_URL" "$RELEASE_DIR" ||
  die "Gagal clone $WAPALA_REPO_URL (branch $WAPALA_BRANCH)."
cd "$RELEASE_DIR"
git rev-parse --short HEAD || true

# ---------- Install + build (serial, hemat memori) ----------
export UV_THREADPOOLSIZE=1
export MALLOC_ARENA_MAX=2
export npm_config_maxsockets=1
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_CI"

log "npm ci (heap ${WAPALA_HEAP_CI}MB)..."
npm ci --no-audit --no-fund --cache "$CACHE_DIR" ||
  die "npm ci gagal."
npm run db:generate || die "prisma generate gagal."

log "next build (heap ${WAPALA_HEAP_BUILD}MB)..."
NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_BUILD" npm run build ||
  die "next build gagal."

[ -f .next/BUILD_ID ] || die ".next/BUILD_ID tidak ditemukan; build tidak valid."
[ -f .next/standalone/server.js ] || die ".next/standalone/server.js tidak ditemukan."

log "Menyiapkan aset standalone..."
mkdir -p .next/standalone/.next
cp -a .next/static .next/standalone/.next/
cp -a public .next/standalone/

# ---------- Migrate + grant role runtime ----------
load_env() { set -a; # shellcheck disable=SC1090
  . "$WAPALA_ENV_FILE"; set +a; }

url_user() { local u="${1#*://}"; u="${u%%@*}"; printf '%s' "${u%%:*}"; }
url_db()   { local u="${1##*/}"; u="${u%%\?*}"; printf '%s' "$u"; }

if [ "$WAPALA_SKIP_MIGRATE" != "1" ]; then
  log "Menjalankan migration..."
  load_env
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL tidak ada di $WAPALA_ENV_FILE."
  migrate_url="${MIGRATE_DATABASE_URL:-$DATABASE_URL}"

  if [ -n "${WAPALA_BACKUP_CMD:-}" ]; then
    log "Menjalankan backup (WAPALA_BACKUP_CMD)..."
    sh -c "$WAPALA_BACKUP_CMD"
  fi

  DATABASE_URL="$migrate_url" npm run db:migrate ||
    die "db:migrate gagal. Release TIDAK diaktifkan."

  runtime_role="$(url_user "$DATABASE_URL")"
  migrate_role="$(url_user "$migrate_url")"
  if [ -n "$runtime_role" ] && [ "$runtime_role" != "$migrate_role" ]; then
    command -v psql >/dev/null ||
      die "psql tidak ada; grant role runtime $runtime_role tidak bisa diterapkan."
    db_name="$(url_db "$DATABASE_URL")"
    log "Menerapkan grant ulang untuk role runtime '$runtime_role' di db '$db_name'..."
    psql "$migrate_url" -v ON_ERROR_STOP=1 -q <<SQL || die "Grant role runtime gagal."
GRANT CONNECT ON DATABASE "$db_name" TO "$runtime_role";
GRANT USAGE ON SCHEMA public TO "$runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "$runtime_role";
REVOKE ALL ON public._prisma_migrations FROM "$runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$runtime_role";
SQL
  fi
else
  log "MIGRATE dilewati (WAPALA_SKIP_MIGRATE=1)."
fi

# ---------- Ownership ----------
if id "$WAPALA_USER" >/dev/null 2>&1; then
  log "Menyesuaikan kepemilikan release untuk user $WAPALA_USER..."
  chown -R "$WAPALA_USER:$WAPALA_USER" "$RELEASE_DIR"
  chmod -R go-w "$RELEASE_DIR"
  media_dir="$(grep -E '^(MEDIA_ROOT)=' "$WAPALA_ENV_FILE" | cut -d= -f2- || true)"
  if [ -n "$media_dir" ] && [ -d "$media_dir" ]; then
    chown "$WAPALA_USER:$WAPALA_USER" "$media_dir"
    chmod 0700 "$media_dir"
  fi
else
  log "User $WAPALA_USER tidak ada; lewati chown."
fi

# ---------- Switch symlink atomik ----------
old_target=""
[ -L "$CURRENT_LINK" ] && old_target="$(readlink "$CURRENT_LINK")" || true
ln -s "$RELEASE_DIR" "$CURRENT_LINK.new.$$"
mv -T "$CURRENT_LINK.new.$$" "$CURRENT_LINK"
log "Aktif: $CURRENT_LINK -> $RELEASE_DIR"

if [ "$WAPALA_SKIP_RESTART" = "1" ]; then
  log "Restart dilewati (WAPALA_SKIP_RESTART=1). Selesai."
  exit 0
fi

# ---------- Restart + health check ----------
log "Restart service $WAPALA_SERVICE..."
systemctl restart "$WAPALA_SERVICE" ||
  die "systemctl restart $WAPALA_SERVICE gagal."

load_env
health_port="${PORT:-3000}"
health_url="http://127.0.0.1:$health_port/api/health"
log "Health check: $health_url"
health_ok=0
for _ in $(seq 1 "$WAPALA_HEALTH_TRIES"); do
  if curl -fsS --max-time 5 "$health_url" >/dev/null 2>&1; then
    health_ok=1
    break
  fi
  sleep 2
done

if [ "$health_ok" != "1" ]; then
  if [ -n "$old_target" ]; then
    log "Health check gagal; ROLLBACK ke release sebelumnya..."
    ln -s "$old_target" "$CURRENT_LINK.rollback.$$"
    mv -T "$CURRENT_LINK.rollback.$$" "$CURRENT_LINK"
    systemctl restart "$WAPALA_SERVICE" || true
    log "Rollback selesai. Periksa: journalctl -u $WAPALA_SERVICE -n 100"
  else
    log "Health check gagal dan tidak ada release sebelumnya. Periksa: journalctl -u $WAPALA_SERVICE -n 100"
  fi
  exit 1
fi

# ---------- Prune release lama ----------
log "Merapikan release lama (simpan $WAPALA_KEEP_RELEASES terbaru)..."
current_target="$(readlink "$CURRENT_LINK")"
count=0
while IFS= read -r dir; do
  [ -d "$RELEASES_DIR/$dir" ] || continue
  count=$((count + 1))
  [ "$count" -le "$WAPALA_KEEP_RELEASES" ] && continue
  full="$RELEASES_DIR/$dir"
  [ "$full" = "$current_target" ] && continue
  [ "$full" = "$old_target" ] && continue
  rm -rf "$full"
  log "Dihapus: $full"
done < <(ls -1 "$RELEASES_DIR" | sort -r)

log "DEPLOY SELESAI: $CURRENT_LINK -> $current_target (HEAD $(cd "$current_target" && git rev-parse --short HEAD 2>/dev/null || echo '?'))"
