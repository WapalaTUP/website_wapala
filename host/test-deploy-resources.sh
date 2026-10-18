#!/usr/bin/env bash
# Isolated regression harness: systemctl is a shell mock, never the real command.
# Run on VPS: bash host/test-deploy-resources.sh (no sudo or npm required).
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d)"
finish_tests() {
  rm -f -- "$TEST_ROOT/state" "$TEST_ROOT/calls"
  rmdir "$TEST_ROOT/cache" 2>/dev/null || true
  rmdir "$TEST_ROOT"
}
trap finish_tests EXIT
log() { :; }
die() { printf '%s\n' "$*" >&2; exit 1; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
declare -A ACTIVE=() LOADED=()
FAIL_STOP=""
FAIL_START=""
MOCK_MEMORY=2048
awk() { printf '%s\n' "$MOCK_MEMORY"; }
systemctl() {
  local action="$1" unit="${@: -1}"
  case "$action" in
    show)
      case "$*" in
        *LoadState*)
          printf '%s\n' "${LOADED[$unit]:-not-found}"
          [ "${LOADED[$unit]:-not-found}" != not-found ] || return 4 ;;
        *ActiveState*) printf '%s\n' "${ACTIVE[$unit]:-inactive}" ;;
        *) fail "Unexpected property: $*" ;;
      esac ;;
    stop)
      printf 'stop %s\n' "$unit" >> "$TEST_ROOT/calls"
      ACTIVE[$unit]=inactive
      [ "$FAIL_STOP" != "$unit" ] ;;
    start)
      printf 'start %s\n' "$unit" >> "$TEST_ROOT/calls"
      [ "$FAIL_START" != "$unit" ] || return 1
      ACTIVE[$unit]=active ;;
    *) fail "Unexpected systemctl operation: $*" ;;
  esac
}
# Load only definitions, not deployment, preflight, network, or service operations.
source <(sed -n '/^# BEGIN DEPLOY RESOURCE FUNCTIONS/,/^# END DEPLOY RESOURCE FUNCTIONS/p' "$SCRIPT_DIR/host-deploy.sh")
reset_case() {
  ACTIVE=()
  LOADED=()
  FAIL_STOP=""
  FAIL_START=""
  MOCK_MEMORY=2048
  PAUSED_UNITS=()
  PAUSE_STATE_CREATED=0
  PAUSE_STATE_FILE="$TEST_ROOT/state"
  CACHE_DIR="$TEST_ROOT/cache"
  WAPALA_SERVICE=wapala
  WAPALA_PAUSE_BACKGROUND=1
  WAPALA_MIN_BUILD_AVAILABLE_MB=1024
  rm -f -- "$PAUSE_STATE_FILE"
  : > "$TEST_ROOT/calls"
  mkdir -p "$CACHE_DIR"
}
load_unit() { LOADED[$1]=loaded; ACTIVE[$1]="$2"; }

reset_case
load_unit wapala-email.timer active
load_unit wapala-email.service inactive
load_unit clamav-daemon.socket active
load_unit clamav-daemon.service active
load_unit clamav-freshclam.service inactive
pause_background_services
[ "${#PAUSED_UNITS[@]}" -eq 3 ] || fail "Wrong original-active snapshot"
[ -f "$PAUSE_STATE_FILE" ] || fail "Recovery state not persisted"
[ "$(head -n 1 "$TEST_ROOT/calls")" = 'stop wapala-email.timer' ] || fail "Timer not stopped first"
restore_background_services
[ "${ACTIVE[clamav-daemon.service]}" = active ] || fail "Scanner not restored"
[ "${ACTIVE[clamav-daemon.socket]}" = active ] || fail "Socket not restored"
[ "${ACTIVE[wapala-email.timer]}" = active ] || fail "Timer not restored"
[ "${ACTIVE[wapala-email.service]}" = inactive ] || fail "Previously inactive worker started"
[ "${ACTIVE[clamav-freshclam.service]}" = inactive ] || fail "Previously inactive updater started"
if grep -Eq '(start|stop) (wapala.service|postgresql.service|nginx.service|ssh.service)$' "$TEST_ROOT/calls"; then
  fail "Essential service touched"
fi
[ ! -e "$PAUSE_STATE_FILE" ] || fail "State not removed after restoration"
calls_before="$(wc -l < "$TEST_ROOT/calls")"
restore_background_services
[ "$(wc -l < "$TEST_ROOT/calls")" -eq "$calls_before" ] || fail "Repeated restoration restarted jobs"
printf 'PASS: state preservation, order, essential services and idempotent restore\n'

reset_case
pause_background_services
restore_background_services
[ ! -s "$TEST_ROOT/calls" ] || fail "Missing units touched"
[ ! -e "$PAUSE_STATE_FILE" ] || fail "Empty state retained"
printf 'PASS: missing units\n'

reset_case
WAPALA_PAUSE_BACKGROUND=0
load_unit clamav-daemon.service active
pause_background_services
[ ! -s "$TEST_ROOT/calls" ] || fail "Opt-out ignored"
[ ! -e "$PAUSE_STATE_FILE" ] || fail "Opt-out created state"
printf 'PASS: opt-out\n'

reset_case
load_unit wapala-email.timer active
load_unit clamav-daemon.service active
FAIL_STOP=clamav-daemon.service
if pause_background_services; then fail "Stop failure ignored"; fi
restore_background_services
[ "${ACTIVE[wapala-email.timer]}" = active ] || fail "Timer not restored after partial stop failure"
[ "${ACTIVE[clamav-daemon.service]}" = active ] || fail "Scanner not restored after partial failure"
printf 'PASS: recovery after partial stop failure\n'

reset_case
load_unit wapala-email.timer active
load_unit clamav-daemon.service active
pause_background_services
FAIL_START=clamav-daemon.service
if restore_background_services; then fail "Restore failure ignored"; fi
[ "$(cat "$PAUSE_STATE_FILE")" = clamav-daemon.service ] || fail "Recovery file must retain only failed unit"
FAIL_START=""
restore_background_services
[ ! -e "$PAUSE_STATE_FILE" ] || fail "Retry did not clear state"
printf 'PASS: failed restoration remains recoverable\n'

reset_case
MOCK_MEMORY=200
if (check_build_memory >/dev/null 2>&1); then fail "Low RAM accepted"; fi
MOCK_MEMORY=1024
check_build_memory
printf 'PASS: available memory guard\n'

reset_case
load_unit clamav-daemon.service active
if (
  trap cleanup EXIT
  pause_background_services
  exit 42
); then
  fail "Failure exit code lost"
else
  result=$?
  [ "$result" -eq 42 ] || fail "Exit code changed during cleanup: $result"
fi
grep -q '^start clamav-daemon.service$' "$TEST_ROOT/calls" || fail "EXIT trap did not restore scanner"
[ ! -e "$PAUSE_STATE_FILE" ] || fail "EXIT trap retained recovered state"
printf 'PASS: EXIT cleanup preserves failure status and restores services\n'

printf 'All isolated deploy resource checks passed. No real services were modified.\n'
