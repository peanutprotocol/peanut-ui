#!/usr/bin/env bash
# Runs one config and prints TLC's full output, with the counterexample trace when there is one.
# usage: verification/tla/tlc.sh Spec.tla [Spec_Variant.cfg]   (needs Java 11+; check-all.sh fetches the jar)
set -euo pipefail
spec=$1; cfg=${2:-${spec%.tla}.cfg}
JAR=${TLA2TOOLS_JAR:-$HOME/.local/share/tla/tla2tools.jar}
cd "$(dirname "$spec")"
exec nice -n 15 java -XX:+UseParallelGC -Xmx2g -cp "$JAR" tlc2.TLC -workers 2 -deadlock -cleanup \
	-metadir "$(mktemp -d)" -config "$(basename "$cfg")" "$(basename "$spec")"
