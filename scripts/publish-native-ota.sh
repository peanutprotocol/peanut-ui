#!/usr/bin/env bash
# The .0 artifact is shared by iOS and Android. Resolve the oldest compatible
# shell for each platform against the binary being built, then use the stricter
# floor on the shared server record. When neither native surface changed, this
# lets (for example) native 1.7.0 receive the exact 1.8.0 web bundle. OTA .1+
# records keep separate -ios/-android identities and can use each floor fully.
#
# PUBLISH_STAGE splits the work so no channel moves before both store builds pass:
#   upload   each platform job, after its store upload: upload (or reuse) and
#            verify the .0 record on the disabled candidate channel.
#   promote  the final job, after both platform jobs passed: verify the same
#            record again, then promote this platform's production channel.
set -euo pipefail
case "$PLATFORM" in ios|android) ;; *) echo 'Invalid platform' >&2; exit 1;; esac
case "${PUBLISH_STAGE:-}" in upload|promote) ;; *) echo 'PUBLISH_STAGE must be upload or promote' >&2; exit 1;; esac
BRIDGE="$(node scripts/capgo-release-guard.mjs bridge-status)"
ANDROID_BRIDGE="$(node scripts/capgo-release-guard.mjs android-bridge-status)"
if [ "$BRIDGE" = active ]; then
  if [ "$PLATFORM" = ios ]; then
    echo 'The iOS 1.5.x bridge is active; native .0 cannot replace it' >&2
    exit 1
  fi
  export ALLOW_IOS_BRIDGE=1
fi
if [ "$ANDROID_BRIDGE" = active ]; then
  if [ "$PLATFORM" = android ]; then
    echo 'The Android 1.6.x bridge is active; native .0 cannot replace it' >&2
    exit 1
  fi
  export ALLOW_ANDROID_BRIDGE=1
fi
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
node scripts/capgo-release-guard.mjs verify-promotion
if [ "$PUBLISH_STAGE" = promote ]; then
  # The platform jobs uploaded and verified this record. Promote only that exact
  # record; a missing one means an upload step did not finish.
  if [ "$(node scripts/capgo-release-guard.mjs existing-native)" != "$VERSION" ]; then
    echo "Native bundle $VERSION was not uploaded by the platform jobs; refusing to promote" >&2
    exit 1
  fi
  node scripts/capgo-release-guard.mjs promote-production
  node scripts/capgo-release-guard.mjs verify-production
  exit 0
fi
test -f out/index.html
node scripts/capgo-release-guard.mjs prepare-candidate
upload_native() {
  npx @capgo/cli@8.42.4 bundle upload \
    --channel ota-candidate --apikey "$CAPGO_API_KEY" --key-data-v2 "$CAPGO_PRIVATE_KEY" \
    --path ./out --bundle "$VERSION" --min-update-version "$NATIVE_FLOOR" \
    --comment "${GITHUB_SHA:0:7} — native release $VERSION [ota-floors: android=$FLOOR_ANDROID ios=$FLOOR_IOS]" \
    --link "https://github.com/peanutprotocol/peanut-ui/commit/$GITHUB_SHA"
}
# iOS and Android publish the same .0 identity in parallel. Both can see it
# missing before one wins creation, and a network error can fail an upload that
# Capgo still stored. After a failure, accept only the exact, fully verified
# record from this source; if none exists, upload once more. Every other state
# still fails closed.
for ATTEMPT in 1 2; do
  EXISTING="$(node scripts/capgo-release-guard.mjs existing-native)"
  if [ "$EXISTING" = "$VERSION" ]; then break; fi
  if [ "$EXISTING" != missing ]; then
    echo "Unexpected native bundle state: $EXISTING" >&2
    exit 1
  fi
  if upload_native; then break; fi
  if [ "$ATTEMPT" = 2 ]; then
    if [ "$(node scripts/capgo-release-guard.mjs existing-native)" != "$VERSION" ]; then
      echo "Native bundle upload failed and no verified concurrent upload exists" >&2
      exit 1
    fi
    break
  fi
  echo "Native bundle upload failed; checking for a stored record before one retry" >&2
  sleep "${CAPGO_UPLOAD_RETRY_DELAY_SECONDS:-15}"
done
node scripts/capgo-release-guard.mjs verify-bundle
