#!/usr/bin/env bash
# The .0 artifact is shared by iOS and Android. Resolve the oldest compatible
# shell for each platform against the binary being built, then use the stricter
# floor on the shared server record. When neither native surface changed, this
# lets (for example) native 1.7.0 receive the exact 1.8.0 web bundle. OTA .1+
# records keep separate -ios/-android identities and can use each floor fully.
set -euo pipefail
case "$PLATFORM" in ios|android) ;; *) echo 'Invalid platform' >&2; exit 1;; esac
resolve_floor() {
  if [ "${IS_REBUILD:-false}" = true ]; then
    node scripts/ota-platform-floor.mjs "$@" --prospective-version "$VERSION" --replacement-platform "$PLATFORM"
  else
    node scripts/ota-platform-floor.mjs "$@" --prospective-version "$VERSION"
  fi
}
FLOOR_ANDROID="$(resolve_floor --platform android)"
FLOOR_IOS="$(resolve_floor --platform ios)"
NATIVE_FLOOR="$(resolve_floor --shared)"
export FLOOR_ANDROID FLOOR_IOS NATIVE_FLOOR
test -f out/index.html
node scripts/capgo-release-guard.mjs verify-promotion
node scripts/capgo-release-guard.mjs prepare-candidate
EXISTING="$(node scripts/capgo-release-guard.mjs existing-native)"
if [ "$EXISTING" = missing ]; then
  if ! npx @capgo/cli@8.42.4 bundle upload \
      --channel ota-candidate --apikey "$CAPGO_API_KEY" --key-data-v2 "$CAPGO_PRIVATE_KEY" \
      --path ./out --bundle "$VERSION" --min-update-version "$NATIVE_FLOOR" \
      --comment "${GITHUB_SHA:0:7} — native release $VERSION [ota-floors: android=$FLOOR_ANDROID ios=$FLOOR_IOS]" \
      --link "https://github.com/peanutprotocol/peanut-ui/commit/$GITHUB_SHA"; then
    # iOS and Android publish the same .0 identity in parallel. Both can see it
    # missing before one wins creation. Recover only when the loser can now
    # read the exact, fully verified record from this source; every other upload
    # error still fails closed.
    RACE_WINNER="$(node scripts/capgo-release-guard.mjs existing-native)"
    if [ "$RACE_WINNER" != "$VERSION" ]; then
      echo "Native bundle upload failed and no verified concurrent upload exists" >&2
      exit 1
    fi
  fi
fi
node scripts/capgo-release-guard.mjs verify-bundle
node scripts/capgo-release-guard.mjs promote-production
node scripts/capgo-release-guard.mjs verify-production
