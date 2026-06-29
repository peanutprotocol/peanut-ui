#!/usr/bin/env bash
#
# Build a signed Android release AAB with an auto-derived, monotonic versionCode.
#
# Version resolution (both consumed by android/app/build.gradle):
#   versionName  ← ANDROID_VERSION_NAME env, else package.json "version"
#   versionCode  ← ANDROID_VERSION_CODE env, else git commit count (monotonic,
#                  no manual bookkeeping; floored at 2 since the rejected first
#                  upload was code 1).
#
# Usage:
#   pnpm native:release                              # auto version from git + package.json
#   ANDROID_VERSION_NAME=1.0.0 pnpm native:release   # override the user-facing name
#   ANDROID_VERSION_CODE=9000 pnpm native:release    # force a code (e.g. to leapfrog a prior upload)
#
# Requires android/keystore.properties (gitignored) for signing — see docs/NATIVE-RELEASE.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION_NAME="${ANDROID_VERSION_NAME:-$(node -p "require('./package.json').version")}"

if [ -n "${ANDROID_VERSION_CODE:-}" ]; then
    VERSION_CODE="$ANDROID_VERSION_CODE"
else
    COUNT="$(git rev-list --count HEAD 2>/dev/null || echo 0)"
    if [ "$COUNT" -lt 2 ]; then VERSION_CODE=2; else VERSION_CODE="$COUNT"; fi
fi

export ANDROID_VERSION_NAME="$VERSION_NAME"
export ANDROID_VERSION_CODE="$VERSION_CODE"

echo "▶ Android release — versionName=$VERSION_NAME  versionCode=$VERSION_CODE"

if [ ! -f android/keystore.properties ]; then
    echo "⚠️  android/keystore.properties not found — the release will be unsigned and rejected by Play."
    echo "    See docs/NATIVE-RELEASE.md §4 (Signing & keystore)."
fi

# 1. static export  → 2. copy web assets + plugins into android/  → 3. signed bundle
node scripts/native-build.js
pnpm exec cap sync android
( cd android && ./gradlew :app:bundleRelease )

AAB="android/app/build/outputs/bundle/release/app-release.aab"
echo ""
if [ -f "$AAB" ]; then
    echo "✅ AAB ready: $AAB  (versionCode $VERSION_CODE, versionName $VERSION_NAME)"
    echo "   Upload to Play (internal track first). See docs/NATIVE-RELEASE.md §7."
else
    echo "❌ Expected AAB not found at $AAB — check the Gradle output above."
    exit 1
fi
