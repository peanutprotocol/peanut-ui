#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
scratch_dir="$(mktemp -d "${TMPDIR:-/tmp}/peanut-passkey-native.XXXXXX")"
trap 'rm -rf "$scratch_dir"' EXIT
cp -R "$repo_dir/node_modules/@capgo/capacitor-passkey/." "$scratch_dir/package"
cd "$scratch_dir/package"
git_bin="${GIT_BIN:-git}"
if [[ "$git_bin" == git && -x /Library/Developer/CommandLineTools/usr/bin/git ]]; then
    git_bin=/Library/Developer/CommandLineTools/usr/bin/git
fi
# Supports either the clean dependency or a dependency already patched by pnpm.
if ! "$git_bin" apply --reverse --check "$repo_dir/patches/@capgo__capacitor-passkey.patch" 2>/dev/null; then
    "$git_bin" apply --check "$repo_dir/patches/@capgo__capacitor-passkey.patch"
    "$git_bin" apply "$repo_dir/patches/@capgo__capacitor-passkey.patch"
fi
if [[ -n "${JAVA_HOME:-}" ]]; then
    java_bin="$JAVA_HOME/bin"
elif [[ -x '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/javac' ]]; then
    java_bin='/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin'
else
    java_bin="$(dirname "$(command -v javac)")"
fi
"$java_bin/javac" -d "$scratch_dir/classes" \
    android/src/main/java/app/capgo/passkey/RequestCoordinator.java \
    "$repo_dir/scripts/passkeys/RequestCoordinatorTest.java"
"$java_bin/java" -cp "$scratch_dir/classes" app.capgo.passkey.RequestCoordinatorTest
node "$repo_dir/scripts/passkeys/test-native-wrapper.mjs" "$scratch_dir/package"
