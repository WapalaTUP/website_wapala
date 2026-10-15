#!/bin/bash
set -euo pipefail
# Samples all host processes/services while an operator runs realistic traffic.
# It does not generate registrations, upload private files or send email.
duration=${1:-300}
[[ "$duration" =~ ^[0-9]+$ ]] && (( duration >= 60 && duration <= 3600 ))
oom_before=$(awk '$1 == "oom_kill" {print $2}' /proc/vmstat)
minimum_available=999999999
for ((second=0; second<duration; second+=5)); do
  available=$(awk '$1 == "MemAvailable:" {print $2}' /proc/meminfo)
  (( available < minimum_available )) && minimum_available=$available
  printf '%s available_kib=%s\n' "$(date -Is)" "$available"
  systemctl show wapala.service wapala-email.service wapala-loans-overdue.service clamav-daemon.service postgresql.service nginx.service -p Id -p MemoryCurrent -p MemoryPeak
  ps -eo pid,rss,comm --sort=-rss | head -n 12 || true
  sleep 5
done
oom_after=$(awk '$1 == "oom_kill" {print $2}' /proc/vmstat)
printf 'minimum_available_kib=%s oom_kills_delta=%s\n' "$minimum_available" "$((oom_after-oom_before))"
test "$oom_before" = "$oom_after"
(( minimum_available >= 204800 ))
echo 'Memory sample passed >=200MiB reserve and no new OOM kills. Attach request latency/error evidence and SMTP/upload/scanner concurrency results before approving 2GB capacity.'
