#!/usr/bin/env bash
# WAPALA "host" deploy script — dijalankan DI SERVER VPS sebagai root/sudo.
# Manual:  sudo bash host/host-deploy.sh
# Otomatis: .github/workflows/deploy-host.yml (SSH, bash -s).
#
# Prinsip keamanan:
#   - npm ci/build/migrate dijalankan sebagai user non-root `builder`
#     (install script dependensi tidak pernah dieksekusi sebagai root).
#   - Env file DIBACA BARIS (tanpa shell eval) — nilai berisi & $ ' tetap aman.
#   - Password DB tidak pernah lewat argv psql (pakai PGPASSWORD).
#   - Release diaktifkan via symlink atomik; rollback otomatis bila
#     health check gagal. KODE release milik root; hanya .next/cache
#     dan media yang writable oleh runtime.
#
# Konfigurasi (environment, default):
#   WAPALA_REPO_URL       https://github.com/WapalaTUP/website_wapala.git
#   WAPALA_BRANCH         host
#   WAPALA_BASE_DIR       /srv/wapala
#   WAPALA_SERVICE        wapala          (unit systemd)
#   WAPALA_RUNTIME_USER   wapala          (user runtime aplikasi)
#   WAPALA_BUILDER        builder         (user build non-root)
#   WAPALA_ENV_FILE       /etc/wapala/production.env
#   WAPALA_KEEP_RELEASES  3
#   WAPALA_HEAP_CI        512   (MB heap saat npm ci)
#   WAPALA_HEAP_BUILD     768   (MB heap saat next build)
#   WAPALA_SKIP_MIGRATE   0     (1 = lewati migrate)
#   WAPALA_SKIP_RESTART   0     (1 = lewati restart/health check)
#   WAPALA_MIN_DISK_MB    2048
#   WAPALA_BACKUP_CMD     (opsional) perintah backup sebelum migrate

set -Eeuo pipefail

WAPALA_BRANCH="${WAPALA_BRANCH:-main}"
WAPALA_BASE_DIR="${WAPALA_BASE_DIR:-/srv/wapala}"
WAPALA_SERVICE="${WAPALA_SERVICE:-wapala}"
WAPALA_RUNTIME_USER="${WAPALA_RUNTIME_USER:-wapala}"
WAPALA_BUILDER="${WAPALA_BUILDER:-builder}"
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

# ---------- Preflight ----------
WAPALA_REPO_URL="${WAPALA_REPO_URL:-https://github.com/WapalaTUP/website_wapala.git}"
[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root (deploy butuh runuser/chown/systemctl)."
command -v git >/dev/null || die "git tidak ditemukan."
command -v node >/dev/null || die "node tidak ditemukan."
command -v npm >/dev/null || die "npm tidak ditemukan."
command -v runuser >/dev/null || die "runuser tidak ditemukan (butuh util-linux)."
id -u "$WAPALA_BUILDER" >/dev/null 2>&1 || die "User build '$WAPALA_BUILDER' tidak ada. Jalankan provisioning dulu."
[ -f "$WAPALA_ENV_FILE" ] || die "Env file $WAPALA_ENV_FILE tidak ada. Jalankan provisioning dulu."

available_mb="$(df -Pm "$WAPALA_BASE_DIR" | awk 'NR==2 {print $4}')"
[ "$available_mb" -ge "$WAPALA_MIN_DISK_MB" ] ||
  die "Ruang disk kurang: ${available_mb}MB tersedia, butuh >= ${WAPALA_MIN_DISK_MB}MB."

# Baca nilai env TANPA shell eval (aman utk nilai berisi & $ ' `).
env_value() { sed -n "s/^$1=//p" "$WAPALA_ENV_FILE" | tail -n 1; }

# Komponen DATABASE_URL tanpa shell eval.
url_user() { local u="${1#*://}"; u="${u%%@*}"; printf '%s' "${u%%:*}"; }
url_db()   { local u="${1##*/}"; u="${u%%\?*}"; printf '%s' "$u"; }
dburl_host() { local u="${1#*://}"; u="${u#*@}"; printf '%s' "${u%%[:/]*}"; }
dburl_port() { local u="${1#*://}"; u="${u#*@}"; local hp="${u%%/*}"; local p="${hp##*:}"; printf '%s' "${p:-5432}"; }
dburl_pass() { local u="${1#*://}"; u="${u%%@*}"; printf '%s' "${u#*:}"; }
# Password lewat PGPASSWORD (env), BUKAN argv agar tidak bocor di `ps`.
run_psql() {
  local url="$1"
  shift
  PGPASSWORD="$(dburl_pass "$url")" psql \
    -h "$(dburl_host "$url")" -p "$(dburl_port "$url")" \
    -U "$(url_user "$url")" -d "$(url_db "$url")" "$@"
}

log "Deploy branch=$WAPALA_BRANCH release=$RELEASE_ID"

# ---------- Prune release gagal SEBELUM build ----------
# Deploy gagal beruntun tidak boleh menghabiskan disk: sisakan
# target current + satu release cadangan; sisanya dihapus.
current_target=""
[ -L "$CURRENT_LINK" ] && current_target="$(readlink "$CURRENT_LINK")" || true
log "Merapikan release lama (simpan current + 1 cadangan)..."
kept=0
while IFS= read -r dir; do
  [ -d "$RELEASES_DIR/$dir" ] || continue
  full="$RELEASES_DIR/$dir"
  if [ -n "$current_target" ] && [ "$full" = "$current_target" ]; then continue; fi
  kept=$((kept + 1))
  [ "$kept" -le 1 ] && continue
  rm -rf "$full"
  log "Dihapus (prune awal): $full"
done < <(ls -1 "$RELEASES_DIR" | sort -r)

# ---------- Clone release baru ----------
mkdir -p "$RELEASES_DIR"
git clone --depth 1 --branch "$WAPALA_BRANCH" --single-branch \
  "$WAPALA_REPO_URL" "$RELEASE_DIR" ||
  die "Gagal clone $WAPALA_REPO_URL (branch $WAPALA_BRANCH)."
HEAD_SHA="$(git -C "$RELEASE_DIR" rev-parse --short HEAD)"
log "HEAD: $HEAD_SHA"

chown -R "$WAPALA_BUILDER:$WAPALA_BUILDER" "$RELEASE_DIR" "$CACHE_DIR"

run_as_builder() {
  runuser -u "$WAPALA_BUILDER" -- env -u NODE_OPTIONS \
    UV_THREADPOOLSIZE=1 MALLOC_ARENA_MAX=2 npm_config_maxsockets=1 \
    npm_config_update_notifier=false NEXT_TELEMETRY_DISABLED=1 "$@"
}

# ---------- Install + build (serial, hemat memori) ----------
log "npm ci sebagai $WAPALA_BUILDER (heap ${WAPALA_HEAP_CI}MB)..."
run_as_builder env NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_CI" \
  npm --prefix "$RELEASE_DIR" ci --no-audit --no-fund --cache "$CACHE_DIR" ||
  die "npm ci gagal."
run_as_builder env NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_CI" \
  npm --prefix "$RELEASE_DIR" run db:generate || die "prisma generate gagal."

log "next build (heap ${WAPALA_HEAP_BUILD}MB)..."
run_as_builder env NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_BUILD" \
  npm --prefix "$RELEASE_DIR" run build || die "next build gagal."

[ -f "$RELEASE_DIR/.next/BUILD_ID" ] || die ".next/BUILD_ID tidak ditemukan; build tidak valid."
[ -f "$RELEASE_DIR/.next/standalone/server.js" ] || die ".next/standalone/server.js tidak ditemukan."

log "Menyiapkan aset standalone..."
mkdir -p "$RELEASE_DIR/.next/standalone/.next/cache"
cp -a "$RELEASE_DIR/.next/static" "$RELEASE_DIR/.next/standalone/.next/"
cp -a "$RELEASE_DIR/public" "$RELEASE_DIR/.next/standalone/"

# ---------- Migrate (sebagai builder; role owner dari env) ----------
if [ "$WAPALA_SKIP_MIGRATE" != "1" ]; then
  runtime_url="$(env_value DATABASE_URL)"
  migrate_url="$(env_value MIGRATE_DATABASE_URL)"
  migrate_url="${migrate_url:-$runtime_url}"
  [ -n "$runtime_url" ] || die "DATABASE_URL tidak ada di $WAPALA_ENV_FILE."
  if [ -n "${WAPALA_BACKUP_CMD:-}" ]; then
    log "Menjalankan backup (WAPALA_BACKUP_CMD)..."
    sh -c "$WAPALA_BACKUP_CMD"
  fi
  log "Menjalankan migration (role owner, bukan runtime)..."
  run_as_builder env NODE_OPTIONS="--max-old-space-size=$WAPALA_HEAP_CI" \
    DATABASE_URL="$migrate_url" npm --prefix "$RELEASE_DIR" run db:migrate ||
    die "db:migrate gagal. Release TIDAK diaktifkan."

  runtime_role="$(url_user "$runtime_url")"
  migrate_role="$(url_user "$migrate_url")"
  if [ -n "$runtime_role" ] && [ "$runtime_role" != "$migrate_role" ]; then
    command -v psql >/dev/null ||
      die "psql tidak ada; grant role runtime '$runtime_role' tidak bisa diterapkan."
    db_name="$(url_db "$runtime_url")"
    log "Menerapkan grant ulang untuk role runtime '$runtime_role' di db '$db_name'..."
    run_psql "$migrate_url" -v ON_ERROR_STOP=1 -q <<SQL || die "Grant role runtime gagal."
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

# ---------- Kepemilikan: kode root, cache & media runtime ----------
if id "$WAPALA_RUNTIME_USER" >/dev/null 2>&1; then
  chown -R root:root "$RELEASE_DIR"
  chmod -R go-w "$RELEASE_DIR"
  chmod 0755 "$RELEASE_DIR"
  chown -R "$WAPALA_RUNTIME_USER:$WAPALA_RUNTIME_USER" \
    "$RELEASE_DIR/.next/standalone/.next/cache"
  media_dir="$(env_value MEDIA_ROOT)"
  if [ -n "$media_dir" ] && [ -d "$media_dir" ]; then
    chown "$WAPALA_RUNTIME_USER:$WAPALA_RUNTIME_USER" "$media_dir"
    chmod 0700 "$media_dir"
  fi
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

health_port="$(env_value PORT)"
health_port="${health_port:-3000}"
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
    log "Rollback kode selesai. PERHATIAN: migration sudah dijalankan —"
    log "kode lama harus kompatibel dengan skema baru (disiplin expand/contract)."
    log "Periksa: journalctl -u $WAPALA_SERVICE -n 100"
  else
    log "Health check gagal dan tidak ada release sebelumnya."
    log "Periksa: journalctl -u $WAPALA_SERVICE -n 100"
  fi
  exit 1
fi

# ---------- Prune release lama (jaga WAPALA_KEEP_RELEASES) ----------
log "Merapikan release lama (simpan $WAPALA_KEEP_RELEASES terbaru)..."
current_target="$(readlink "$CURRENT_LINK")"
count=0
while IFS= read -r dir; do
  [ -d "$RELEASES_DIR/$dir" ] || continue
  count=$((count + 1))
  [ "$count" -le "$WAPALA_KEEP_RELEASES" ] && continue
  full="$RELEASES_DIR/$dir"
  [ "$full" = "$current_target" ] && continue
  rm -rf "$full"
  log "Dihapus: $full"
done < <(ls -1 "$RELEASES_DIR" | sort -r)

log "DEPLOY SELESAI: $CURRENT_LINK -> $current_target (HEAD $HEAD_SHA)"
