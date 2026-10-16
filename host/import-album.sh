#!/usr/bin/env bash
# WAPALA — Import Album awal (paket situs publik dari repo staging lama).
#
#   sudo bash host/import-album.sh
#
# Sumber paket: repo lama hulwanulazka-companion/wapala_dev @ staging,
# folder import-packages/wapala-public-site (21 angkatan, 22 album, 129 foto).
# Anggota/inventaris TIDAK ikut diimpor. Importer idempoten: re-import
# hanya melaporkan skip/konflik dan TIDAK PERNAH menghapus data.
#
# Alur: konfirmasi sumber -> backup -> cek service -> ambil paket ->
#       dry-run -> review -> apply -> verifikasi.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${WAPALA_ENV_FILE:-/etc/wapala/production.env}"
CURRENT_LINK="${WAPALA_BASE_DIR:-/srv/wapala}/current"
DEFAULT_REPO="https://github.com/hulwanulazka-companion/wapala_dev.git"
DEFAULT_BRANCH="staging"
PACKAGE_PATH="import-packages/wapala-public-site"

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""
fi
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
title(){ printf '\n%s%s── %s ──────────────────────────────%s\n' "$C_BOLD" "$C_CYAN" "$*" "$C_RESET"; }
step() { printf '%s▸%s %s\n' "$C_MAGENTA" "$C_RESET" "$*"; }

# ---------- Guard ----------
[ "$(id -u)" -eq 0 ] || { err "Jalankan sebagai root: sudo bash host/import-album.sh"; exit 1; }
if [ ! -t 0 ] || [ ! -t 1 ]; then
  err "Mode interaktif butuh terminal (TTY) — importer menyentuh data produksi."
  exit 1
fi
[ -f "$ENV_FILE" ] || { err "Env file $ENV_FILE tidak ada — jalankan installer dulu."; exit 1; }
[ -d "$CURRENT_LINK" ] || { err "$CURRENT_LINK belum ada — deploy dulu."; exit 1; }
[ -f "$CURRENT_LINK/scripts/import-public-site.ts" ] ||
  { err "Importer tidak ditemukan di release aktif. Deploy rilis terbaru dulu (host/wapala.sh -> Deploy ulang)."; exit 1; }
command -v git >/dev/null || { err "git tidak ditemukan."; exit 1; }

env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }

# ---------- 1. Sumber paket ----------
title "Sumber paket import"
ask "URL repo paket" "$DEFAULT_REPO"
repo="$REPLY"
ask "Branch paket" "$DEFAULT_BRANCH"
branch="$REPLY"

# ---------- 2. Backup ----------
title "Backup (WAJIB sebelum impor)"
if confirm "Jalankan backup database + media sekarang?" y; then
  ask "Direktori tujuan backup" "/root/wapala-backup"
  backup_dir="$REPLY/backup-import-$(date +%F-%H%M%S)"
  mkdir -p "$backup_dir"
  step "Menjalankan backup ke $backup_dir ..."
  sudo sh -c "set -a; . $ENV_FILE; set +a; cd $CURRENT_LINK; node scripts/release-backup.mjs backup '$backup_dir'" ||
    { err "Backup gagal — IMPORT DIBATALKAN."; exit 1; }
  ok "Backup selesai: $backup_dir (salin ke luar server!)"
else
  confirm "Sudah ada backup yang valid? TANPA backup ini akan dibatalkan." n ||
    { err "Buat backup dulu."; exit 1; }
fi

# ---------- 3. Service ----------
title "Cek service pendukung"
for svc in postgresql clamav-daemon; do
  if systemctl is-active --quiet "$svc"; then
    ok "$svc active"
  else
    err "$svc TIDAK aktif — importer butuh database dan scanner."
    exit 1
  fi
done

# ---------- 4. Ambil paket ----------
title "Mengambil paket dari $repo @ $branch"
paket_dir="$(mktemp -d /tmp/wapala-public-import.XXXXXX)"
cleanup() { rm -rf "$paket_dir"; }
trap cleanup EXIT

git clone --depth 1 --branch "$branch" --single-branch "$repo" "$paket_dir/repo" ||
  { err "Gagal clone paket — periksa URL/branch."; exit 1; }
pkg="$paket_dir/repo/$PACKAGE_PATH"
[ -f "$pkg/manifest.json" ] || { err "manifest.json tidak ditemukan di $PACKAGE_PATH."; exit 1; }
[ -f "$CURRENT_LINK/scripts/import-public-site.ts" ] ||
  { err "Importer tidak ada di release aktif."; exit 1; }
# Paket hanya berisi data publik; service user perlu membacanya.
chmod -R a+rX "$paket_dir/repo"
ok "Paket siap: $pkg"
warn "Isi paket: $(find "$pkg" -type f | wc -l) berkas."

# ---------- 5. Dry-run ----------
run_import() { # run_import [flags]
  local flags="$1"
  systemd-run --wait --pipe --collect \
    --uid=wapala --gid=wapala \
    --property=SupplementaryGroups=clamav \
    --property=WorkingDirectory=$CURRENT_LINK \
    --property=EnvironmentFile=$ENV_FILE \
    "$(command -v node)" --import tsx --conditions=react-server \
    "$CURRENT_LINK/scripts/import-public-site.ts" \
    "$pkg" $flags
}

title "Dry-run (tanpa menulis data)"
echo "Periksa laporan di bawah. Error checksum/scanner/konflik = JANGAN lanjut."
echo
if ! run_import ""; then
  err "Dry-run GAGAL — impor dibatalkan."
  exit 1
fi

# ---------- 6. Apply ----------
title "Apply"
echo "  Database  : $(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | sed 's|://[^@]*@|://***@|')"
echo "  Media root: $(env_value MEDIA_ROOT)"
warn "Ini MENULIS data ke database dan media produksi (idempoten; tidak menghapus)."
confirm "Lanjutkan APPLY sekarang?" n || { echo "Dibatalkan — paket tidak diubah."; exit 0; }

run_import "--apply --allow-production" || { err "Apply gagal — periksa laporan."; exit 1; }
ok "Impor selesai."

# ---------- 7. Verifikasi ----------
title "Verifikasi hasil"
db_name="$(env_value DATABASE_URL)"; db_name="${db_name##*/}"; db_name="${db_name%%\?*}"
for q in 'SELECT COUNT(*) AS jumlah_angkatan FROM "Generation";' \
         "SELECT COUNT(*) AS jumlah_album FROM \"ContentRecord\" WHERE kind = 'galeri';"; do
  run "psql -d $db_name -c \"$q\""
  sudo -u postgres psql -d "$db_name" -c "$q" || warn "Query verifikasi gagal."
done
health_port="$(env_value PORT)"; health_port="${health_port:-3000}"
if curl -fsS --max-time 5 "http://127.0.0.1:$health_port/api/health" >/dev/null 2>&1; then
  ok "Health check OK."
else
  warn "Health check gagal — journalctl -u wapala -n 100"
fi
cat <<CATATAN

Catatan:
- Hitungan SQL mencakup seluruh data (termasuk yang dibuat manual).
- Referensi paket lama: 21 angkatan, 22 album, 129 foto album.
- Anggota/inventaris tidak ikut diimpor.
- Re-import aman (idempoten): lihat laporan jumlah yang dilewati/konflik,
  JANGAN menghapus data agar bisa mengulang.
CATATAN
