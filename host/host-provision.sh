#!/usr/bin/env bash
# WAPALA "host" provisioning — dijalankan SEKALI di VPS Ubuntu 22.04/24.04,
# dari hasil git clone branch main. Sesuai mode VPS:
#
#   Dedicated IP : sudo bash deploy/host-provision.sh <domain> <email-certbot>
#   NAT VPS      : sudo WAPALA_NAT_MODE=1 WAPALA_NAT_HTTP_PORT=33335 \
#                        WAPALA_NAT_HTTPS_PORT=33336 \
#                        bash deploy/host-provision.sh <domain> <email-certbot>
#
# Memasang: Node.js 24, PostgreSQL, Nginx, Certbot, build tools; database
# (role owner migrate + role runtime terbatas), direktori, env template,
# unit systemd, Nginx HTTP -> sertifikat TLS -> Nginx HTTPS.
#
# Opsi environment:
#   WAPALA_NAT_MODE=1           mode NAT VPS (port publik terbatas)
#   WAPALA_NAT_HTTP_PORT=33335  port internal nginx HTTP  (pasangan provider)
#   WAPALA_NAT_HTTPS_PORT=33336 port internal nginx HTTPS (pasangan provider)
#   WAPALA_NAT_PUBLIC_HTTPS_PORT=... port PUBLIK HTTPS (untuk redirect; default = HTTPS_PORT)
#   WAPALA_SKIP_CERTBOT=1       lewati penerbitan sertifikat (TLS manual)
#   WAPALA_PROVISION_CLAMAV=1   pasang ClamAV + wrapper (upload butuh ini)
#   WAPALA_ENABLE_UFW=1         aktifkan UFW (OpenSSH, 80, 443 / port NAT)
#   WAPALA_DB_PASSWORD=...      password role owner (acak bila kosong)
#   WAPALA_APP_DB_PASSWORD=...  password role runtime (acak bila kosong)
#   WAPALA_DB_NAME=wapala       nama database

set -Eeuo pipefail

log()  { printf '[wapala-provision] %s\n' "$*"; }
die()  { printf '[wapala-provision] ERROR: %s\n' "$*" >&2; exit 1; }
here() { cd "$(dirname "$0")" && pwd; }

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root (sudo)."
DOMAIN="${1:-${WAPALA_DOMAIN:-}}"
[ -n "$DOMAIN" ] || die "Domain wajib: sudo bash deploy/host-provision.sh <domain>"
CERTBOT_EMAIL="${2:-${WAPALA_CERTBOT_EMAIL:-}}"
DB_NAME="${WAPALA_DB_NAME:-wapala}"
APP_DIR="/srv/wapala"
MEDIA_ROOT="/var/lib/wapala/media"
ETC_DIR="/etc/wapala"
ACME_ROOT="/var/www/acme"
ENV_FILE="$ETC_DIR/production.env"
NAT_MODE="${WAPALA_NAT_MODE:-0}"
NAT_HTTP_PORT="${WAPALA_NAT_HTTP_PORT:-33335}"
NAT_HTTPS_PORT="${WAPALA_NAT_HTTPS_PORT:-33336}"
NAT_PUBLIC_HTTPS_PORT="${WAPALA_NAT_PUBLIC_HTTPS_PORT:-$NAT_HTTPS_PORT}"
PROVISION_CLAMAV="${WAPALA_PROVISION_CLAMAV:-0}"
SKIP_CERTBOT="${WAPALA_SKIP_CERTBOT:-0}"
# Email: disabled (default, provider sering blokir SMTP) atau smtp lengkap.
EMAIL_MODE_OPT="${WAPALA_EMAIL_MODE:-disabled}"
SMTP_HOST_OPT="${WAPALA_SMTP_HOST:-}"
SMTP_PORT_OPT="${WAPALA_SMTP_PORT:-587}"
SMTP_USER_OPT="${WAPALA_SMTP_USER:-}"
SMTP_PASSWORD_OPT="${WAPALA_SMTP_PASSWORD:-}"
SMTP_FROM_OPT="${WAPALA_SMTP_FROM:-}"
case "$EMAIL_MODE_OPT" in smtp|disabled) ;; *) die "WAPALA_EMAIL_MODE harus 'smtp' atau 'disabled'." ;; esac
if [ "$EMAIL_MODE_OPT" = "smtp" ]; then
  [ -n "$SMTP_HOST_OPT" ] && [ -n "$SMTP_USER_OPT" ] && [ -n "$SMTP_PASSWORD_OPT" ] && [ -n "$SMTP_FROM_OPT" ] ||
    die "EMAIL_MODE=smtp butuh WAPALA_SMTP_HOST/USER/PASSWORD/FROM."
fi

command -v curl >/dev/null || { apt-get update; apt-get install -y curl; }

# ---------- Paket sistem ----------
log "Memasang paket sistem (bisa beberapa menit)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg build-essential git \
  postgresql postgresql-contrib postgresql-client nginx certbot ffmpeg

if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
  log "Memasang Node.js 24 (NodeSource)..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y nodejs
fi
node -v
NODE_BIN="$(command -v node)"
log "Node: $NODE_BIN $(node -v)"

systemctl enable --now postgresql >/dev/null 2>&1 || true
pg_isready -q || die "PostgreSQL tidak siap."
PG_PORT="$(pg_isready | sed -n 's/^.*:\([0-9]*\) - accept.*/\1/p' || echo 5432)"

# ---------- User layanan & direktori ----------
id -u wapala >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin wapala
# User build non-root: npm ci/build/migrate TIDAK pernah jalan sebagai root.
id -u builder >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/builder --shell /bin/bash builder
mkdir -p "$APP_DIR/releases" "$ETC_DIR" "$MEDIA_ROOT" "$ACME_ROOT"
chmod 0755 "$APP_DIR" "$APP_DIR/releases"
chmod 0700 "$ETC_DIR"
chown root:root "$ETC_DIR"
chown -R wapala:wapala "$MEDIA_ROOT"
chmod 0700 "$MEDIA_ROOT"

# ---------- Database: role owner (migrate) + role runtime terbatas ----------
DB_OWNER_PW="${WAPALA_DB_PASSWORD:-$(openssl rand -hex 16)}"
DB_APP_PW="${WAPALA_APP_DB_PASSWORD:-$(openssl rand -hex 16)}"

if [ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='wapala'")" != "1" ]; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q \
    -c "CREATE ROLE wapala LOGIN PASSWORD '$DB_OWNER_PW';"
  log "Role 'wapala' (owner/migration) dibuat."
else
  log "Role 'wapala' sudah ada; password tidak diubah."
  DB_OWNER_PW="(sudah ada)"
fi

if [ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='wapala_app'")" != "1" ]; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q \
    -c "CREATE ROLE wapala_app LOGIN PASSWORD '$DB_APP_PW';"
  log "Role 'wapala_app' (runtime terbatas) dibuat."
else
  log "Role 'wapala_app' sudah ada; password tidak diubah."
  DB_APP_PW="(sudah ada)"
fi

if [ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" != "1" ]; then
  runuser -u postgres -- createdb -O wapala "$DB_NAME"
  log "Database '$DB_NAME' dibuat (owner wapala)."
else
  log "Database '$DB_NAME' sudah ada."
fi

# ---------- Env file privat ----------
if [ ! -f "$ENV_FILE" ]; then
  log "Membuat $ENV_FILE (mode email: $EMAIL_MODE_OPT)..."
  security_key="$(openssl rand -base64 32)"
  media_scanner_line="# MEDIA_SCANNER=/usr/local/libexec/clamdscan-wapala"
  [ "$PROVISION_CLAMAV" = "1" ] && media_scanner_line="MEDIA_SCANNER=/usr/local/libexec/clamdscan-wapala"
  # Bagian statis via heredoc (nilai aman: hex/base64/regex domain);
  # nilai dari operator (SMTP) ditulis via printf %s agar karakter
  # khusus pada password tidak diekspansikan shell.
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
WAPALA_MODE=backend
APP_URL=https://$DOMAIN
DATABASE_URL=postgresql://wapala_app:$DB_APP_PW@127.0.0.1:$PG_PORT/$DB_NAME
MIGRATE_DATABASE_URL=postgresql://wapala:$DB_OWNER_PW@127.0.0.1:$PG_PORT/$DB_NAME
SECURITY_KEY=$security_key
TRUST_PROXY=true
EMAIL_MODE=$EMAIL_MODE_OPT
MEDIA_ROOT=$MEDIA_ROOT
$media_scanner_line
HOSTNAME=127.0.0.1
PORT=3000
NODE_OPTIONS=--max-old-space-size=640
EOF
  printf 'SMTP_HOST=%s\nSMTP_PORT=%s\nSMTP_USER=%s\nSMTP_PASSWORD=%s\nSMTP_FROM=%s\n' \
    "$SMTP_HOST_OPT" "$SMTP_PORT_OPT" "$SMTP_USER_OPT" "$SMTP_PASSWORD_OPT" "$SMTP_FROM_OPT" >> "$ENV_FILE"
  if [ "$EMAIL_MODE_OPT" = "disabled" ]; then
    printf '# EMAIL_MODE=disabled: notifikasi email mati; pemulihan akun via SSH/panel.\n' >> "$ENV_FILE"
  fi
  chmod 0600 "$ENV_FILE"
  chown root:root "$ENV_FILE"
  log "Env template dibuat. EDIT $ENV_FILE untuk menyesuaikan."
else
  log "$ENV_FILE sudah ada; tidak diubah."
  # Re-provision dengan domain baru: APP_URL lama (mis. placeholder) ikut
  # diperbarui bila WAPALA_FORCE_APP_URL=1 — tanpa menyentuh secret lain.
  if [ "${WAPALA_FORCE_APP_URL:-0}" = "1" ] &&
     [ "$(sed -n 's/^APP_URL=//p' "$ENV_FILE" | tail -n 1)" != "https://$DOMAIN" ]; then
    sed -i "s|^APP_URL=.*|APP_URL=https://$DOMAIN|" "$ENV_FILE"
    chmod 0600 "$ENV_FILE"
    chown root:root "$ENV_FILE"
    log "APP_URL diperbarui ke https://$DOMAIN (WAPALA_FORCE_APP_URL=1)."
  fi
fi

# ---------- systemd unit ----------
log "Memasang unit systemd (aplikasi + maintenance)..."
unit_tmp="$(mktemp)"
sed "s|/usr/bin/node|$NODE_BIN|" "$(here)/wapala-host.service" > "$unit_tmp"
if [ "$PROVISION_CLAMAV" = "1" ]; then
  sed -i 's/^Group=wapala$/Group=wapala\nSupplementaryGroups=clamav/' "$unit_tmp"
fi
mv "$unit_tmp" /etc/systemd/system/wapala.service
chmod 0644 /etc/systemd/system/wapala.service
NPM_BIN="$(dirname "$NODE_BIN")/npm"
sed "s|/usr/bin/npm|$NPM_BIN|" "$(here)/wapala-maintenance.service" \
  > /etc/systemd/system/wapala-maintenance.service
chmod 0644 /etc/systemd/system/wapala-maintenance.service
install -m 0644 "$(here)/wapala-maintenance.timer" /etc/systemd/system/wapala-maintenance.timer
systemctl daemon-reload
systemctl enable wapala.service >/dev/null 2>&1 || true

# ---------- Worker email (hanya bila EMAIL_MODE=smtp) ----------
if [ "$EMAIL_MODE_OPT" = "smtp" ]; then
  sed "s|/usr/bin/npm|$NPM_BIN|" "$(here)/wapala-email.service" \
    > /etc/systemd/system/wapala-email.service
  install -m 0644 "$(here)/wapala-email.timer" /etc/systemd/system/wapala-email.timer
  systemctl daemon-reload
  systemctl enable --now wapala-email.timer >/dev/null 2>&1 || true
  log "Worker email: timer 5 menit aktif (EMAIL_MODE=smtp)."
else
  log "Worker email tidak dipasang (EMAIL_MODE=disabled)."
fi
# Timer maintenance (prune throttle/session/token) — service akan gagal
# tanpa bahaya sampai deploy pertama membuat /srv/wapala/current.
systemctl enable wapala-maintenance.timer >/dev/null 2>&1 || true
systemctl start wapala-maintenance.timer >/dev/null 2>&1 || true

# ---------- ClamAV (opsional) ----------
if [ "$PROVISION_CLAMAV" = "1" ]; then
  log "Memasang ClamAV (unduhan signature besar, tunggu)..."
  apt-get install -y clamav clamav-daemon clamav-freshclam
  # Buku app hingga 50 MB; default clamd 25M akan menolak scan-nya.
  grep -q '^StreamMaxLength' /etc/clamav/clamd.conf 2>/dev/null ||
    echo 'StreamMaxLength 60M' >> /etc/clamav/clamd.conf
  systemctl enable --now clamav-freshclam >/dev/null 2>&1 || true
  freshclam || log "freshclam gagal; jalankan ulang manual sebelum upload dipakai."
  systemctl enable --now clamav-daemon >/dev/null 2>&1 || true
  systemctl restart clamav-daemon >/dev/null 2>&1 || true
  install -m 0755 "$(here)/clamdscan-wapala.sh" /usr/local/libexec/clamdscan-wapala
  log "Scanner wrapper: /usr/local/libexec/clamdscan-wapala (StreamMaxLength 60M)"
else
  log "ClamAV dilewati. TANPA scanner, upload media akan ditolak (fail-closed)."
fi

# ---------- Nginx: HTTP dulu -> sertifikat -> HTTPS ----------
if [ "$NAT_MODE" = "1" ]; then
  listen_port="$NAT_HTTP_PORT"
  log "Mode NAT: nginx HTTP listen internal :$listen_port (pastikan provider meneruskan publik :80 -> internal :$listen_port untuk ACME)."
else
  listen_port="80"
fi
log "Memasang Nginx (tahap HTTP)..."
cat > /etc/nginx/sites-available/wapala.conf <<EOF
server {
    listen $listen_port;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root $ACME_ROOT; }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/wapala.conf /etc/nginx/sites-enabled/wapala.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if [ "$SKIP_CERTBOT" != "1" ]; then
  [ -n "$CERTBOT_EMAIL" ] || die "Email certbot wajib: bash deploy/host-provision.sh $DOMAIN <email>"
  log "Menerbitkan sertifikat Let's Encrypt untuk $DOMAIN..."
  certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" \
    --email "$CERTBOT_EMAIL" --agree-tos --non-interactive \
    --deploy-hook "systemctl reload nginx" ||
    die "Certbot gagal. Pastikan DNS/forwarding $DOMAIN sudah mengarah ke server ini
      (dedicated: A record -> IP VPS; NAT: provider meneruskan publik :80 -> internal :$listen_port
      dan domain terdaftar di panel provider). Alternatif: WAPALA_SKIP_CERTBOT=1 lalu DNS-01 manual."
  log "Mengaktifkan konfigurasi HTTPS penuh..."
  if [ "$NAT_MODE" = "1" ]; then
    sed -e "s/wapala.example.org/$DOMAIN/g" \
        -e "s/listen 33335/listen $NAT_HTTP_PORT/" \
        -e "s/33336/$NAT_PUBLIC_HTTPS_PORT/g" \
        -e "s/listen $NAT_PUBLIC_HTTPS_PORT ssl/listen $NAT_HTTPS_PORT ssl/" \
        "$(here)/nginx-wapala-nat.conf" > /etc/nginx/sites-available/wapala.conf
    if [ "$NAT_PUBLIC_HTTPS_PORT" = "443" ]; then
      sed -i "s|\$host:$NAT_PUBLIC_HTTPS_PORT|\$host|" /etc/nginx/sites-available/wapala.conf
    fi
  else
    sed "s/wapala.example.org/$DOMAIN/g" "$(here)/nginx-wapala.conf" \
      > /etc/nginx/sites-available/wapala.conf
  fi
  nginx -t && systemctl reload nginx
else
  log "Certbot dilewati; TLS diatur manual (WAPALA_SKIP_CERTBOT=1)."
fi

# ---------- Firewall (opsional) ----------
if [ "${WAPALA_ENABLE_UFW:-0}" = "1" ] && command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  [ "$NAT_MODE" = "1" ] && { ufw allow "$NAT_HTTP_PORT/tcp" >/dev/null; ufw allow "$NAT_HTTPS_PORT/tcp" >/dev/null; }
  ufw --force enable
  log "UFW aktif."
fi

# ---------- Ringkasan ----------
if [ "$NAT_MODE" = "1" ]; then
  akses="https://$DOMAIN:$NAT_PUBLIC_HTTPS_PORT"
  dns_txt="A record '$DOMAIN' -> IP publik provider + daftarkan domain di panel NAT (Source Domain)"
else
  akses="https://$DOMAIN"
  dns_txt="A record '$DOMAIN' -> IP publik VPS ini"
fi
cat <<RINGKASAN

================= PROVISIONING SELESAI =================
Mode         : $([ "$NAT_MODE" = "1" ] && echo "NAT VPS (HTTP:$NAT_HTTP_PORT HTTPS:$NAT_HTTPS_PORT)" || echo "Dedicated IP (80/443)")
Domain       : $akses
Database     : $DB_NAME (PostgreSQL 127.0.0.1:$PG_PORT)
Role runtime : wapala_app  -> DATABASE_URL          (tanpa DDL)
Role migrate : wapala      -> MIGRATE_DATABASE_URL  (owner)
Password DB  : runtime=$DB_APP_PW owner=$DB_OWNER_PW
Env file     : $ENV_FILE (mode 0600, EDIT sebelum deploy)
Unit         : wapala.service (enabled; start otomatis oleh deploy pertama)
Builder      : user non-root 'builder' (npm/build tidak pernah sebagai root)
Maintenance  : wapala-maintenance.timer 03:17 (prune throttle/sesi/token)
Email        : $EMAIL_MODE_OPT $([ "$EMAIL_MODE_OPT" = "smtp" ] && echo "(worker timer 5 menit aktif)")
ClamAV       : $([ "$PROVISION_CLAMAV" = "1" ] && echo "terpasang" || echo "TIDAK (upload ditolak sampai dipasang)")

LANGKAH BERIKUTNYA:
1. DNS: $dns_txt. Verifikasi: dig +short $DOMAIN
2. Edit $ENV_FILE: verifikasi APP_URL/DB/SECURITY_KEY, isi SMTP bila perlu.
3. Set GitHub secrets: VPS_HOST, VPS_PORT (SSH), VPS_USER, VPS_SSH_KEY, VPS_KNOWN_HOSTS.
4. Push ke branch 'main' -> GitHub Actions deploy otomatis (opsional).
========================================================
RINGKASAN
