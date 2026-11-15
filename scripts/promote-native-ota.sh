#!/usr/bin/env bash
# Promotes the native .0 bundle to the production channel of every platform that
# needs it, in the final job of release-native.yml. That job runs only after both
# store builds passed and both platform jobs uploaded and verified the bundle.
#
# Before 2026-10-11 each platform job promoted its own channel. When the other
# platform then failed, one channel served a build number with no tag, and every
# later OTA stopped on it (Oct 7 and Oct 9). Here, if the second promotion fails,
# the first channel goes back to the bundle it served before, so both channels
# keep serving one release.
set -euo pipefail
: "${VERSION:?VERSION is required}"

PLATFORMS=()
if [ "${IOS_NEEDS_OTA:-false}" = true ]; then PLATFORMS+=(ios); fi
if [ "${ANDROID_NEEDS_OTA:-false}" = true ]; then PLATFORMS+=(android); fi
if [ "${#PLATFORMS[@]}" -eq 0 ]; then
  echo "No platform channel needs bundle $VERSION; nothing to promote"
  exit 0
fi

# PREVIOUS[i] is the bundle PLATFORMS[i] served. Indexed, not associative:
# macOS ships bash 3.2, which has no declare -A.
PREVIOUS=()
for i in "${!PLATFORMS[@]}"; do
  PLATFORM="${PLATFORMS[$i]}"
  export PLATFORM
  PREVIOUS[i]="$(node scripts/capgo-release-guard.mjs current-version)"
  echo "$PLATFORM channel serves ${PREVIOUS[$i]} before promotion"
done

PROMOTED=()
restore_promoted() {
  local status=$?
  if [ "$status" -eq 0 ]; then return 0; fi
  # PROMOTED is a prefix of PLATFORMS, so its indices also index PREVIOUS.
  local i
  for i in "${!PROMOTED[@]}"; do
    PLATFORM="${PROMOTED[$i]}"
    export PLATFORM
    echo "::error::promotion of $VERSION failed; returning the $PLATFORM channel to ${PREVIOUS[$i]}" >&2
    if ! PREVIOUS_VERSION="${PREVIOUS[$i]}" node scripts/capgo-release-guard.mjs restore-production; then
      echo "::error::could not return the $PLATFORM channel to ${PREVIOUS[$i]}; fix it in Capgo before the next release" >&2
    fi
  done
  exit "$status"
}
trap restore_promoted EXIT

for PLATFORM in "${PLATFORMS[@]}"; do
  # Recorded before the call: a failure after the channel write (for example in
  # verify-production) must still return this channel.
  PROMOTED+=("$PLATFORM")
  export PLATFORM
  PUBLISH_STAGE=promote bash scripts/publish-native-ota.sh
done
echo "Promoted $VERSION to: ${PLATFORMS[*]}"
