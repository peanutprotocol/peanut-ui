#!/usr/bin/env bash
# The .0 artifact can be shared only after verifying the exact source and equal
# native floors. OTA .1+ records instead have separate -ios/-android identities.
set -euo pipefail
case "$PLATFORM" in ios|android) ;; *) echo 'Invalid platform' >&2; exit 1;; esac
export FLOOR_ANDROID="$VERSION" FLOOR_IOS="$VERSION" NATIVE_FLOOR="$VERSION"
test -f out/index.html
node scripts/capgo-release-guard.mjs verify-promotion
node scripts/capgo-release-guard.mjs prepare-candidate
EXISTING="$(node scripts/capgo-release-guard.mjs existing-native)"
if [ "$EXISTING" = missing ]; then
  if ! npx @capgo/cli@8.42.4 bundle upload \
      --channel ota-candidate --apikey "$CAPGO_API_KEY" --key-data-v2 "$CAPGO_PRIVATE_KEY" \
      --path ./out --bundle "$VERSION" --min-update-version "$VERSION" \
      --comment "${GITHUB_SHA:0:7} — native release $VERSION [ota-floors: android=$VERSION ios=$VERSION]" \
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
