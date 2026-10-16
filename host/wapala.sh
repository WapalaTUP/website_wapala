#!/usr/bin/env bash
# WAPALA — installer & manajer interaktif.
#
#   sudo bash host/wapala.sh
#
# Satu entrypoint dengan deteksi otomatis:
#   - Instalasi belum ada  -> ALUR INSTALL (tanya -> provision -> deploy -> Super User)
#   - Instalasi terdeteksi -> MENU MANAJEMEN (deploy ulang, rollback, log, backup, ...)
#
# Semua pekerjaan berat tetap dijalankan script non-interaktif (host-provision.sh,
# host-deploy.sh) supaya GitHub Actions / cron / otomasi lain tidak terpengaruh.
# Script ini HANYA untuk sesi SSH interaktif.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${WAPALA_ENV_FILE:-/etc/wapala/production.env}"
BASE_DIR="${WAPALA_BASE_DIR:-/srv/wapala}"
CURRENT_LINK="$BASE_DIR/current"
RELEASES_DIR="$BASE_DIR/releases"
SERVICE="${WAPALA_SERVICE:-wapala}"
RUNTIME_USER="${WAPALA_RUNTIME_USER:-wapala}"
REPO_URL="${WAPALA_REPO_URL:-https://github.com/WapalaTUP/website_wapala.git}"
BRANCH="${WAPALA_BRANCH:-main}"

# ---------- Tampilan (ANSI) ----------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'
  C_CYAN=$'\033[36m'; C_MAGENTA=$'\033[35m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""; C_MAGENTA=""
fi
ok()    { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()   { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
title() { printf '\n%s%s── %s ──────────────────────────────%s\n' "$C_BOLD" "$C_CYAN" "$*" "$C_RESET"; }
step()  { printf '%s▸%s %s\n' "$C_MAGENTA" "$C_RESET" "$*"; }
run()   { printf '\n%s%s$ %s%s\n' "$C_DIM" "$C_BOLD" "$*" "$C_RESET"; }

banner() {
  printf '%s%s' "$C_BOLD" "$C_CYAN"
  cat <<'LOGO'
  ╭──────────────────────────────────────────────╮
  │        WAPALA — Installer & Manager          │
  │   Website WAPALA · Telkom University Purwokerto │
  ╰──────────────────────────────────────────────╯
LOGO
  printf '%s' "$C_RESET"
}

# ---------- Interaksi ----------
ask() { # ask PROMPT [DEFAULT] -> REPLY
  local prompt="$1" default="${2:-}"
  if [ -n "$default" ]; then
    read -r -e -p "$(printf '%s%s%s [%s]: ' "$C_BOLD" "$prompt" "$C_RESET" "$default")" REPLY
    REPLY="${REPLY:-$default}"
  else
    read -r -e -p "$(printf '%s%s%s: ' "$C_BOLD" "$prompt" "$C_RESET")" REPLY
  fi
}
confirm() { # confirm PROMPT [default=y|n] -> 0 jika ya
  local prompt="$1" def="${2:-y}" a
  read -r -p "$(printf '%s%s%s [y/n, default %s]: ' "$C_BOLD" "$prompt" "$C_RESET" "$def")" a
  a="${a:-$def}"
  [[ "$a" =~ ^[Yy] ]]
}
choose() { # choose PROMPT opt1 opt2 ... -> CHOSEN (global)
  local prompt="$1"; shift
  local i=1 opt
  printf '%s\n' "$prompt"
  for opt in "$@"; do printf '  %s%d)%s %s\n' "$C_BOLD" "$i" "$C_RESET" "$opt"; i=$((i + 1)); done
  while true; do
    read -r -p "$(printf '%sPilih nomor%s: ' "$C_BOLD" "$C_RESET")" REPLY
    if [[ "$REPLY" =~ ^[0-9]+$ ]] && [ "$REPLY" -ge 1 ] && [ "$REPLY" -le "$#" ]; then
      CHOSEN="${!REPLY}"
      return 0
    fi
    warn "Pilihan tidak valid."
  done
}

validate_domain() { [[ "$1" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]]; }
validate_port()   { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
validate_email()  { [[ "$1" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; }
# Deteksi kasar IP edge Cloudflare (prefix /16 khas rentang resmi CF).
# Dipakai installer agar domain ber-proxy CDN tidak dianggap "DNS salah".
is_cf_ip() {
  local a b
  IFS=. read -r a b _ _ <<< "$1" 2>/dev/null || return 1
  case "$a.$b" in
    104.16|104.17|104.18|104.19|104.20|104.21|104.22|104.23|104.24|104.25|104.26|104.27|\
    172.64|172.65|172.66|172.67|172.68|172.69|172.70|172.71|\
    162.158|188.114|198.41|141.101|108.162|190.93|197.234|131.0|173.245|\
    103.21|103.22|103.31) return 0 ;;
  esac
  return 1
}

# ---------- Preflight ----------
preflight() {
  title "Preflight"
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null && sudo -n true 2>/dev/null; then
      exec sudo -E bash "$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")" "$@"
    fi
    err "Script harus dijalankan sebagai root: sudo bash host/wapala.sh"
    exit 1
  fi
  if [ ! -t 0 ] || [ ! -t 1 ]; then
    err "Mode interaktif butuh terminal (TTY)."
    echo "  Untuk otomasi/CI, pakai script non-interaktif:"
    echo "    sudo bash host/host-provision.sh <domain> <email>"
    echo "    sudo bash host/host-deploy.sh"
    exit 1
  fi
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] ||
    warn "Diuji di Ubuntu 22.04/24.04 — distribusi ini: ${PRETTY_NAME:-?} (lanjut dengan risiko sendiri)."
  command -v git >/dev/null || warn "git belum ada — provisioning akan memasangnya."
  local ram total_mb
  ram=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  [ "$ram" -lt 1800 ] && warn "RAM ${ram} MB < 1800 MB — build berisiko OOM (lihat README bagian Kapasitas)."
  local disk_mb
  disk_mb=$(df -Pm "$PWD" | awk 'NR==2 {print $4}')
  [ "$disk_mb" -lt 3000 ] && warn "Disk bebas ${disk_mb} MB < 3000 MB."
  ok "Preflight selesai (RAM ${ram} MB, disk bebas ${disk_mb} MB)."
}

installed() { [ -f "$ENV_FILE" ] && [ -d "$RELEASES_DIR" ]; }

# ---------- Alur INSTALL ----------
install_flow() {
  title "Alur Install — VPS baru"

  local mode nat_http nat_https nat_public_https domain email ufw clamav
  local smtp=0 smtp_host="" smtp_port=587 smtp_user="" smtp_pass="" smtp_from=""

  echo
  warn "ClamAV menambah pemakaian RAM ~1-1.5 GB (signature penuh). Tanpa ClamAV, upload media ditolak (fail-closed)."
  if confirm "Pasang ClamAV sekarang? (agar upload langsung bisa diuji setelah live)" y; then clamav=1; else clamav=0; fi

  choose "Mode VPS yang dipakai?" \
    "Dedicated IP — port standar 80/443" \
    "NAT VPS — port publik terbatas dari provider"
  mode="$CHOSEN"

  local nat_env=""
  if [[ "$mode" == NAT* ]]; then
    echo
    warn "Mode NAT: pasangan port HARUS sesuai panel provider (beda-beda tiap provider)."
    while true; do
      ask "Port INTERNAL nginx HTTP (Destination Port baris HTTP)" ; nat_http="$REPLY"
      validate_port "$nat_http" && break
      err "Port tidak valid (1-65535)."
    done
    while true; do
      ask "Port INTERNAL nginx HTTPS (Destination Port baris HTTPS)" ; nat_https="$REPLY"
      validate_port "$nat_https" && break
      err "Port tidak valid (1-65535)."
    done
    while true; do
      ask "Port PUBLIK HTTPS (Source Port baris HTTPS, biasanya 443)" ; nat_public_https="$REPLY"
      validate_port "$nat_public_https" && break
      err "Port tidak valid (1-65535)."
    done
    nat_env="WAPALA_NAT_MODE=1 WAPALA_NAT_HTTP_PORT=$nat_http WAPALA_NAT_HTTPS_PORT=$nat_https WAPALA_NAT_PUBLIC_HTTPS_PORT=$nat_public_https"
  fi

  while true; do
    ask "Domain (mis. wapala-test.my.id)" ; domain="${REPLY,,}"
    validate_domain "$domain" && break
    err "Format domain tidak valid."
  done
  while true; do
    ask "Email sertifikat Let's Encrypt (notifikasi, bebas pakai Gmail)" ; email="$REPLY"
    validate_email "$email" && break
    err "Format email tidak valid."
  done

  # SMTP (opsional)
  echo
  warn "Banyak provider VPS memblokir/membatasi SMTP keluar — setelah live, wajib uji pengiriman nyata."
  if confirm "Konfigurasi SMTP sekarang? (tidak = EMAIL_MODE disabled, pemulihan akun via SSH/panel)" n; then
    smtp=1
    while true; do ask "SMTP host" ; smtp_host="$REPLY"; [ -n "$smtp_host" ] && break; err "SMTP host wajib diisi."; done
    while true; do ask "SMTP port" "587" ; smtp_port="$REPLY"; validate_port "$smtp_port" && break; err "Port tidak valid."; done
    while true; do ask "SMTP user" ; smtp_user="$REPLY"; [ -n "$smtp_user" ] && break; err "SMTP user wajib diisi."; done
    read -r -s -p "$(printf '%sSMTP password%s: ' "$C_BOLD" "$C_RESET")" smtp_pass; echo
    [ -n "$smtp_pass" ] || { err "SMTP password wajib diisi."; exit 1; }
    ask "Email pengirim (SMTP_FROM)" "$email" ; smtp_from="$REPLY"
    validate_email "$smtp_from" || { err "Format email pengirim tidak valid."; exit 1; }
  fi

  # Deteksi DNS
  local skip_certbot=0 server_ip resolved
  server_ip="$(curl -fsS --max-time 10 ifconfig.me 2>/dev/null || echo '')"
  resolved="$(getent hosts "$domain" 2>/dev/null | awk '{print $1; exit}')"
  title "Deteksi DNS"
  echo "  IP server ini : ${server_ip:-tidak terdeteksi}"
  echo "  DNS $domain : ${resolved:-BELUM ADA}"
  if [ -n "$server_ip" ] && [ "$resolved" != "$server_ip" ]; then
    if is_cf_ip "$resolved"; then
      ok "DNS $domain -> Cloudflare edge ($resolved) — proxy CDN aktif; TLS tetap diterbitkan di origin."
    else
      choose "DNS belum mengarah ke server ini. Bagaimana?" \
        "Lanjut TANPA TLS dulu (nanti aktifkan setelah DNS siap)" \
        "Ulangi pengecekan DNS" \
        "Batalkan"
      case "$CHOSEN" in
        Lanjut*) skip_certbot=1 ;;
        Ulangi*) install_flow "$@"; return ;;
        *) echo "Dibatalkan."; exit 0 ;;
      esac
    fi
  fi

  echo
  if confirm "Aktifkan firewall UFW (SSH + port web)?" y; then ufw=1; else ufw=0; fi

  title "Ringkasan"
  echo "  Mode        : $mode"
  [ -n "$nat_env" ] && echo "  Port NAT    : HTTP=$nat_http HTTPS=$nat_https (publik $nat_public_https)"
  echo "  Domain      : https://$domain"
  echo "  Email       : $email"
  echo "  TLS         : $([ "$skip_certbot" = 1 ] && echo 'DITUNDA (DNS belum siap)' || echo "Let's Encrypt otomatis")"
  echo "  ClamAV      : $([ "$clamav" = 1 ] && echo ya || echo TIDAK — upload mati)"
  if [ "$smtp" = 1 ]; then
    echo "  SMTP        : aktif -> $smtp_host:$smtp_port (from $smtp_from; worker email tiap 5 menit)"
  else
    echo "  SMTP        : disabled — notifikasi email mati, pemulihan via SSH/panel"
  fi
  echo "  UFW         : $([ "$ufw" = 1 ] && echo ya || echo tidak)"
  echo "  Repo/branch : $REPO_URL @ $BRANCH"
  echo "  Auto-start on boot: AKTIF (systemd enable)"
  confirm "Lanjut provisioning?" || { echo "Dibatalkan."; exit 0; }

  # Env dikirim via array: password SMTP dengan spasi/karakter khusus tetap aman.
  local -a prov_env=(
    WAPALA_FORCE_APP_URL=1
    "WAPALA_PROVISION_CLAMAV=$clamav"
    "WAPALA_EMAIL_MODE=$([ "$smtp" = 1 ] && echo smtp || echo disabled)"
  )
  [ "$smtp" = 1 ] && prov_env+=(
    "WAPALA_SMTP_HOST=$smtp_host" "WAPALA_SMTP_PORT=$smtp_port"
    "WAPALA_SMTP_USER=$smtp_user" "WAPALA_SMTP_PASSWORD=$smtp_pass"
    "WAPALA_SMTP_FROM=$smtp_from"
  )
  [ "$ufw" = 1 ] && prov_env+=(WAPALA_ENABLE_UFW=1)
  [ "$skip_certbot" = 1 ] && prov_env+=(WAPALA_SKIP_CERTBOT=1)

  run "env ${prov_env[*]} bash $SCRIPT_DIR/host-provision.sh $domain $email"
  env "${prov_env[@]}" bash "$SCRIPT_DIR/host-provision.sh" "$domain" "$email" ||
    { err "Provisioning gagal — periksa output di atas."; exit 1; }

  title "Build & Deploy (10-20 menit di 1 vCPU — jangan tutup sesi; aman dijalankan ulang)"
  run "WAPALA_REPO_URL=$REPO_URL WAPALA_BRANCH=$BRANCH bash $SCRIPT_DIR/host-deploy.sh"
  WAPALA_REPO_URL="$REPO_URL" WAPALA_BRANCH="$BRANCH" bash "$SCRIPT_DIR/host-deploy.sh" ||
    { err "Deploy gagal — periksa output di atas."; exit 1; }

  title "Verifikasi"
  local port; port="$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n1)"; port="${port:-3000}"
  if curl -fsS --max-time 5 "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
    ok "Health check lokal: OK"
  else
    err "Health check lokal GAGAL — journalctl -u $SERVICE -n 100"
  fi
  systemctl is-enabled --quiet "$SERVICE" && ok "Auto-start on boot: AKTIF"

  title "Super User"
  if confirm "Buat token bootstrap Super User sekarang?" y; then
    sudo_and_env "npm --silent run auth:bootstrap-token" &&
      echo "Buka https://$domain/wapala dan selesaikan setup (token 30 menit)."
  else
    echo "Nanti manual:"
    echo "  sudo sh -c 'set -a; . $ENV_FILE; set +a; cd $CURRENT_LINK; npm run auth:bootstrap-token'"
  fi

  title "SELESAI"
  ok "Situs: https://$domain"
  echo "  Update berikutnya : sudo bash host/wapala.sh  → Deploy ulang"
  echo "  Status/log        : sudo bash host/wapala.sh"
  echo "  Panduan lengkap   : README.md + host/deploy-walkthrough.md"
}

# Jalankan perintah sebagai user runtime dengan env produksi terbaca.
sudo_and_env() {
  local cmd="$1"
  sudo sh -c "set -a; . $ENV_FILE; set +a; cd $CURRENT_LINK; $cmd"
}

# ---------- Menu MANAJEMEN ----------
manage_flow() {
  title "Instalasi terdeteksi"
  echo "  Aktif : $CURRENT_LINK -> $(readlink "$CURRENT_LINK" 2>/dev/null || echo '?')"
  echo "  Domain: $(sed -n 's/^APP_URL=//p' "$ENV_FILE" | tail -n1)"
  while true; do
    title "Menu Manajemen WAPALA"
    cat <<'MENU'
  1) Deploy ulang (pull + build + migrate)
  2) Status (service, RAM, release)
  3) Log aplikasi (live)
  4) Rollback ke release sebelumnya
  5) Backup database + media
  6) Prune maintenance manual
  7) Pasang ClamAV (jika belum)
  8) Import Album awal (paket publik import-packages)
  9) Info sertifikat TLS
  u) Update kode repo ini (git pull)
  0) Keluar
MENU
    read -r -p "$(printf '%sPilih%s: ' "$C_BOLD" "$C_RESET")" REPLY
    case "$REPLY" in
      1) deploy_again ;;
      2) show_status ;;
      3) run "journalctl -u $SERVICE -f (Ctrl+C untuk keluar)"; journalctl -u "$SERVICE" -f ;;
      4) rollback_flow ;;
      5) backup_flow ;;
      6) run "maintenance:prune"; sudo_and_env "npm --silent run maintenance:prune" && ok "Prune selesai." ;;
      7) clamav_flow ;;
      8) run "bash $SCRIPT_DIR/import-album.sh"; bash "$SCRIPT_DIR/import-album.sh" ;;
      9) tls_info ;;
      u|U) update_repo ;;
      0) echo "Sampai jumpa."; exit 0 ;;
      *) warn "Pilihan tidak valid." ;;
    esac
  done
}

# Tarik kode terbaru untuk checkout repo ini (script installer + tool ops).
# Dijalankan sebagai pemilik checkout agar tidak merusak kepemilikan berkas;
# git sebagai root di repo milik user lain akan menolak (dubious ownership).
update_repo() {
  local repo_dir
  repo_dir="$(dirname "$SCRIPT_DIR")"
  [ -d "$repo_dir/.git" ] || { err "Bukan checkout git: $repo_dir"; return; }
  local owner branch dirty head
  owner="$(stat -c '%U' "$repo_dir")"
  branch="$(sudo -u "$owner" git -C "$repo_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  dirty="$(sudo -u "$owner" git -C "$repo_dir" status --porcelain 2>/dev/null)"
  [ -n "$dirty" ] && warn "Ada perubahan lokal — akan di-stash sementara sebelum pull."
  run "git -C $repo_dir pull --ff-only origin $branch (user $owner)"
  [ -n "$dirty" ] && sudo -u "$owner" git -C "$repo_dir" stash || true
  # Tarik EKSPLISIT per branch: config upstream/refspec lama (mis. sisa
  # clone single-branch host) tidak bisa merusak pull.
  if sudo -u "$owner" git -C "$repo_dir" pull --ff-only origin "$branch"; then
    head="$(sudo -u "$owner" git -C "$repo_dir" rev-parse --short HEAD)"
    ok "Kode terbaru aktif: $head"
    echo "  - Perubahan host/*.sh & scripts/*.sh : langsung aktif di menu ini"
    echo "  - Perubahan kode aplikasi (src/)     : perlu '1) Deploy ulang'"
  else
    err "git pull gagal (konflik/koneksi) — selesaikan manual di $repo_dir"
  fi
}

deploy_again() {
  local deploy_branch="$BRANCH"
  choose "Deploy dari branch mana?" "main — production" "staging — build uji"
  case "$CHOSEN" in
    staging*) deploy_branch="staging" ;;
    *) deploy_branch="main" ;;
  esac
  run "WAPALA_REPO_URL=$REPO_URL WAPALA_BRANCH=$deploy_branch bash $SCRIPT_DIR/host-deploy.sh"
  WAPALA_REPO_URL="$REPO_URL" WAPALA_BRANCH="$deploy_branch" bash "$SCRIPT_DIR/host-deploy.sh" &&
    ok "Deploy selesai ($deploy_branch)." || err "Deploy gagal — lihat output."
}

show_status() {
  local current
  current="$(readlink "$CURRENT_LINK" 2>/dev/null || echo '?')"
  systemctl status "$SERVICE" --no-pager -l | head -n 12 || true
  echo
  systemctl is-enabled --quiet "$SERVICE" && ok "Auto-start on boot: AKTIF" || warn "Auto-start: MATI"
  echo
  free -h
  echo
  echo "Releases (branch asal):"
  local r marker
  while IFS= read -r r; do
    [ -n "$r" ] || continue
    marker=""
    [ -f "$RELEASES_DIR/$r/.deploy-branch" ] && marker="[$(cat "$RELEASES_DIR/$r/.deploy-branch")]"
    printf '  %s %s %s\n' "$r" "$marker" "$([ "$RELEASES_DIR/$r" = "$current" ] && echo '<- aktif')"
  done < <(ls -1 "$RELEASES_DIR" 2>/dev/null | tail -n 8)
  echo "Aktif: $current"
}

rollback_flow() {
  local current list=() i=1 target choice
  current="$(readlink "$CURRENT_LINK" 2>/dev/null || true)"
  mapfile -t list < <(ls -1 "$RELEASES_DIR" | sort -r)
  echo "Aktif: $current $([ -f "$current/.deploy-branch" ] && echo "[$(cat "$current/.deploy-branch")]")"
  local idx=1
  for r in "${list[@]}"; do
    [ "$RELEASES_DIR/$r" = "$current" ] && continue
    marker=""
    [ -f "$RELEASES_DIR/$r/.deploy-branch" ] && marker=" [$(cat "$RELEASES_DIR/$r/.deploy-branch")]"
    printf '  %d) %s%s %s\n' "$idx" "$r" "$marker" "$([ -f "$RELEASES_DIR/$r/.next/BUILD_ID" ] || echo '(tanpa BUILD_ID — dilewati)')"
    idx=$((idx + 1))
  done
  [ "$idx" -le 1 ] && { warn "Tidak ada release lain untuk rollback."; return; }
  read -r -p "$(printf '%sNomor release tujuan%s: ' "$C_BOLD" "$C_RESET")" choice
  [[ "$choice" =~ ^[0-9]+$ ]] || { err "Tidak valid."; return; }
  i=1
  for r in "${list[@]}"; do
    [ "$RELEASES_DIR/$r" = "$current" ] && continue
    if [ "$i" = "$choice" ]; then target="$RELEASES_DIR/$r"; break; fi
    i=$((i + 1))
  done
  [ -z "${target:-}" ] && { err "Pilihan tidak ditemukan."; return; }
  [ -f "$target/.next/BUILD_ID" ] || { err "Release itu tidak valid (tanpa BUILD_ID)."; return; }
  confirm "Rollback ke $(basename "$target")? (PERHATIAN: migration mungkin sudah berjalan)" n || return
  ln -sfn "$target" "$CURRENT_LINK" && systemctl restart "$SERVICE"
  sleep 3
  if curl -fsS --max-time 5 "http://127.0.0.1:$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n1)/api/health" >/dev/null 2>&1; then
    ok "Rollback sukses, health OK: $target"
  else
    err "Health check gagal setelah rollback — journalctl -u $SERVICE -n 100"
  fi
}

backup_flow() {
  local dir repo_dir
  repo_dir="$(dirname "$SCRIPT_DIR")"
  ask "Direktori tujuan backup" "$repo_dir/backups"
  dir="$REPLY/backup-$(date +%F-%H%M%S)"
  # release-backup.mjs menolak folder tujuan yang SUDAH ada (ia membuatnya
  # sendiri) dan membutuhkan parent siap — jadi hanya siapkan parent-nya.
  mkdir -p "$(dirname "$dir")"
  # release-backup.mjs menuntut writer berhenti — hentikan app, backup,
  # lalu nyalakan lagi + health check.
  warn "Backup konsisten butuh writer berhenti: aplikasi DIHENTIKAN sementara."
  confirm "Hentikan app -> backup -> nyalakan lagi?" y || return
  systemctl stop "$SERVICE" wapala-maintenance.timer 2>/dev/null || true
  local failed=0
  run "node scripts/release-backup.mjs backup $dir (role owner; WAPALA_WRITERS_STOPPED=yes)"
  # pg_dump membaca SEMUA tabel termasuk _prisma_migrations yang ditolak
  # dari role runtime — backup memakai role owner (operator tepercaya).
  sudo_and_env "export WAPALA_WRITERS_STOPPED=yes; export DATABASE_URL=\"\${MIGRATE_DATABASE_URL:-\$DATABASE_URL}\"; node scripts/release-backup.mjs backup '$dir'" || failed=1
  systemctl start "$SERVICE" wapala-maintenance.timer 2>/dev/null || true
  sleep 3
  if curl -fsS --max-time 5 "http://127.0.0.1:$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n1)/api/health" >/dev/null 2>&1; then
    ok "App kembali hidup."
  else
    err "App belum sehat — journalctl -u $SERVICE -n 50"
  fi
  if [ "$failed" = "0" ]; then
    ok "Backup selesai: $dir (salin ke luar server!)"
  else
    err "Backup gagal — lihat output."
  fi
}

clamav_flow() {
  if grep -q '^MEDIA_SCANNER=' "$ENV_FILE" && ! grep -q '^# MEDIA_SCANNER' "$ENV_FILE"; then
    ok "MEDIA_SCANNER sudah aktif di env."
    systemctl is-active --quiet clamav-daemon && ok "clamav-daemon active." ||
      warn "clamav-daemon tidak aktif: sudo systemctl restart clamav-daemon"
    return
  fi
  confirm "Pasang ClamAV sekarang? (~1-1.5 GB RAM tambahan)" y || return
  run "apt-get install clamav clamav-daemon clamav-freshclam"
  apt-get install -y clamav clamav-daemon clamav-freshclam
  run "freshclam (5-15 menit)"
  systemctl stop clamav-freshclam 2>/dev/null || true
  freshclam || warn "freshclam gagal — ulangi manual."
  grep -q '^StreamMaxLength' /etc/clamav/clamd.conf 2>/dev/null ||
    echo 'StreamMaxLength 60M' >> /etc/clamav/clamd.conf
  systemctl enable --now clamav-freshclam >/dev/null 2>&1 || true
  systemctl restart clamav-daemon
  mkdir -p /usr/local/libexec
  install -m 0755 "$SCRIPT_DIR/clamdscan-wapala.sh" /usr/local/libexec/clamdscan-wapala
  sed -i 's|^# MEDIA_SCANNER=.*|MEDIA_SCANNER=/usr/local/libexec/clamdscan-wapala|' "$ENV_FILE"
  grep -q '^MEDIA_SCANNER=' "$ENV_FILE" ||
    echo 'MEDIA_SCANNER=/usr/local/libexec/clamdscan-wapala' >> "$ENV_FILE"
  sed -i 's|^Group=wapala$|Group=wapala\nSupplementaryGroups=clamav|' /etc/systemd/system/wapala.service
  chmod 0600 "$ENV_FILE" && chown root:root "$ENV_FILE"
  systemctl daemon-reload && systemctl restart wapala
  ok "ClamAV terpasang. Uji:"
  sudo -u "$RUNTIME_USER" /usr/local/libexec/clamdscan-wapala --no-summary --infected -- /etc/hostname &&
    ok "Scanner OK (exit 0)" || err "Scanner gagal — periksa clamav-daemon."
}

tls_info() {
  local domain; domain="$(sed -n 's/^APP_URL=//p' "$ENV_FILE" | tail -n1 | sed 's|https://||')"
  run "certbot certificates"
  certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry|Domains" || true
  echo
  echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null |
    openssl x509 -noout -issuer -dates || warn "TLS belum aktif untuk $domain"
  echo
  systemctl list-timers | grep -i certbot || warn "Timer certbot tidak ditemukan."
}

# ---------- Main ----------
main() {
  banner
  preflight "$@"
  if installed; then
    manage_flow
  else
    echo
    confirm "Instalasi belum ditemukan. Mulai ALUR INSTALL sekarang?" y || { echo "Dibatalkan."; exit 0; }
    install_flow
  fi
}

main "$@"
