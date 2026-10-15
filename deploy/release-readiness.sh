#!/bin/bash
set -euo pipefail
# Run on staging/VPS after deployment; no configuration or database writes.
test "$(node -p 'process.versions.node.split(".")[0]')" = 24
systemctl is-active --quiet wapala.service postgresql.service clamav-daemon.service clamav-freshclam.service nginx.service
systemctl is-enabled --quiet wapala-email.timer
nginx -t
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3000/api/health >/dev/null
test -n "${APP_URL:-}" && test "${APP_URL#https://}" != "$APP_URL"
curl --fail --silent --show-error --max-time 15 "$APP_URL/api/health" >/dev/null
# Real scanner smoke test: temporary isolated files, never uploaded/stored.
check_dir=$(mktemp -d /tmp/wapala-scanner-check.XXXXXX)
trap 'rm -f -- "$check_dir/clean.txt" "$check_dir/eicar.txt"; rmdir -- "$check_dir"' EXIT
printf 'clean scanner readiness file\n' > "$check_dir/clean.txt"
printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > "$check_dir/eicar.txt"
chmod 755 "$check_dir"
chmod 644 "$check_dir/clean.txt" "$check_dir/eicar.txt"
sudo -u wapala -g clamav /usr/local/libexec/clamdscan-wapala --no-summary --infected -- "$check_dir/clean.txt" >/dev/null
set +e
sudo -u wapala -g clamav /usr/local/libexec/clamdscan-wapala --no-summary --infected -- "$check_dir/eicar.txt" >/dev/null
scan_result=$?
set -e
test "$scan_result" = 1
echo 'Health/TLS/native antivirus checks passed; SMTP delivery, restore drill and mixed-load memory benchmark are additional release gates.'
