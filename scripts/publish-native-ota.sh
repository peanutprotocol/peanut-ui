#!/usr/bin/env bash
# The .0 artifact is shared by iOS and Android. Resolve the oldest compatible
# shell for each platform against the binary being built, then use the stricter
# floor on the shared server record. When neither native surface changed, this
# lets (for example) native 1.7.0 receive the exact 1.8.0 web bundle. OTA .1+
# records keep separate -ios/-android identities and can use each floor fully.
set -euo pipefail
case "$PLATFORM" in ios|android) ;; *) echo 'Invalid platform' >&2; exit 1;; esac
FLOOR_ANDROID="$(node scripts/ota-platform-floor.mjs --platform android --prospective-version "$VERSION")"
FLOOR_IOS="$(node scripts/ota-platform-floor.mjs --platform ios --prospective-version "$VERSION")"
NATIVE_FLOOR="$(node scripts/ota-platform-floor.mjs --shared --prospective-version "$VERSION")"
export FLOOR_ANDROID FLOOR_IOS NATIVE_FLOOR
test -f out/index.html
node scripts/capgo-release-guard.mjs verify-promotion
node scripts/capgo-release-guard.mjs prepare-candidate
EXISTING="$(node scripts/capgo-release-guard.mjs existing-native)"
if [ "$EXISTING" = missing ]; then
  npx @capgo/cli@8.42.4 bundle upload \
    --channel ota-candidate --apikey "$CAPGO_API_KEY" --key-data-v2 "$CAPGO_PRIVATE_KEY" \
    --path ./out --bundle "$VERSION" --min-update-version "$NATIVE_FLOOR" \
    --comment "${GITHUB_SHA:0:7} — native release $VERSION [ota-floors: android=$FLOOR_ANDROID ios=$FLOOR_IOS]" \
    --link "https://github.com/peanutprotocol/peanut-ui/commit/$GITHUB_SHA"
fi
node scripts/capgo-release-guard.mjs verify-bundle
node scripts/capgo-release-guard.mjs verify-promotion
npx @capgo/cli@8.42.4 channel set "$PLATFORM-mobile-release" --apikey "$CAPGO_API_KEY" --bundle "$VERSION"
node scripts/capgo-release-guard.mjs verify-production
