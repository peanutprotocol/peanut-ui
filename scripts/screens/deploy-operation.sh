#!/usr/bin/env bash
set -euo pipefail
phase=$1
shift
[[ "$phase" =~ ^[a-z][a-z0-9-]{0,63}$ ]] || exit 2
started=$SECONDS
umask 077
operation_dir=$(mktemp -d)
operation_pid=
progress_pid=
cleanup() {
    if [[ -n "$progress_pid" ]]; then
        kill "$progress_pid" 2>/dev/null || true
        wait "$progress_pid" 2>/dev/null || true
    fi
    if [[ -n "$operation_pid" ]]; then
        kill "$operation_pid" 2>/dev/null || true
        wait "$operation_pid" 2>/dev/null || true
    fi
    rm -rf "$operation_dir"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
printf 'phase=%s completed=0/1 elapsed=0s retry=0\n' "$phase"
# Keep Wrangler's own sanitization enabled. Its private log records API errors
# that 4.40.2 can suppress on the console during JSON migration-ledger queries.
WRANGLER_LOG_PATH="$operation_dir/wrangler.log" WRANGLER_LOG_SANITIZE=true \
    timeout --signal=TERM --kill-after=10s 270s "$@" >"$operation_dir/console.log" 2>&1 &
operation_pid=$!
(
    sleeper=
    trap 'kill "${sleeper:-}" 2>/dev/null || true; exit 0' TERM INT
    while true; do
        sleep 45 &
        sleeper=$!
        wait "$sleeper"
        printf 'phase=%s completed=0/1 elapsed=%ss retry=0\n' "$phase" "$((SECONDS - started))"
    done
) &
progress_pid=$!
status=0
wait "$operation_pid" || status=$?
operation_pid=
# Never stream raw command output or debug HTTP bodies to the runner log.
# All calls run from the trusted checkout root, including the /tmp helper copy.
if ! node scripts/screens/deploy-diagnostics.mjs "$operation_dir" "$status"; then
    printf 'phase=%s diagnostics=unavailable\n' "$phase" >&2
    if [[ "$status" -eq 0 ]]; then status=1; fi
fi
if [[ "$status" -ne 0 ]]; then
    printf 'phase=%s completed=0/1 elapsed=%ss retry=0 status=failed exit_code=%s\n' "$phase" "$((SECONDS - started))" "$status" >&2
    exit "$status"
fi
printf 'phase=%s completed=1/1 elapsed=%ss retry=0\n' "$phase" "$((SECONDS - started))"
