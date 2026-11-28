#!/usr/bin/env bash
# Model-checks every spec in this folder. A config named *_Buggy*.cfg models code that is (or was)
# wrong, so TLC must find a violation: if it stops finding one, the model no longer captures the bug.
# Every other config models the code as it is, so TLC must find no error.
# usage: verification/tla/check-all.sh [Spec_Variant.cfg ...]   (CI: the tla job of the tests workflow)
#   TLC_WORKERS=2 nice -n 15 verification/tla/check-all.sh    on a laptop
set -uo pipefail
cd "$(dirname "$0")"

JAR=${TLA2TOOLS_JAR:-$HOME/.local/share/tla/tla2tools.jar}
SHA=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88   # tla2tools v1.7.4
if [ ! -f "$JAR" ]; then
	mkdir -p "$(dirname "$JAR")"
	curl -sSLf -o "$JAR" https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar
fi
echo "$SHA  $JAR" | sha256sum -c --quiet - || { echo "tla2tools.jar checksum mismatch"; exit 1; }

meta=$(mktemp -d)
trap 'rm -rf "$meta"' EXIT
cfgs=("$@")
[ ${#cfgs[@]} -eq 0 ] && cfgs=(*.cfg)

fail=0
start_all=$SECONDS
for cfg in "${cfgs[@]}"; do
	spec=${cfg%%_*}.tla
	start=$SECONDS
	out=$(java -XX:+UseParallelGC -Xmx2g -cp "$JAR" tlc2.TLC -workers "${TLC_WORKERS:-auto}" -deadlock -cleanup \
		-metadir "$meta/${cfg%.cfg}" -config "$cfg" "$spec" 2>&1)
	if grep -q "No error has been found" <<<"$out"; then
		distinct=$(sed -nE 's/.* ([0-9]+) distinct states found.*/\1/p' <<<"$out" | tail -1)
		if [ -z "$distinct" ] || [ "$distinct" -le 1 ]; then
			result="vacuous(${distinct:-0}_states)"
		else
			result=holds
		fi
	elif grep -qE "is violated|properties were violated" <<<"$out"; then
		expected=$(sed -nE 's/^\\\*[[:space:]]*Expect:[[:space:]]*(.+)$/\1/p' "$cfg" | head -1 | tr -d '\r')
		if [ -n "$expected" ]; then
			if grep -qE "(Invariant|Action property|Property) ${expected} is violated|Temporal properties were violated" <<<"$out"; then
				result=breaks
			else
				result="wrong_violation(expected_${expected})"
			fi
		else
			result=breaks
		fi
	else result=error; fi
	case "$cfg" in *_Buggy*) want=breaks ;; *) want=holds ;; esac
	if [ "$result" = "$want" ]; then
		echo "ok    $cfg: $result ($((SECONDS - start))s)"
	else
		echo "FAIL  $cfg: expected $want, got $result ($((SECONDS - start))s)"
		tail -30 <<<"$out"
		fail=1
	fi
done
echo "TLC total: $((SECONDS - start_all))s for ${#cfgs[@]} configs"
exit $fail
