# OTA first, native build second

The split starts from `dev` commit `18c935832`. The shipped native baseline is
`v1.6.0` (`331002ff83e95593e92f12fdf870201f25f1f6d0`).

1. Merge `innolope/release-ota-first-0923` into `main`. It retains the dev web
   changes and defers Wallet provisioning (#3153) and the Apple Watch follow-up
   (#3345), including their JavaScript callers and release tooling. Its native
   fingerprint is identical to v1.6.0. The existing main-push OTA workflow
   publishes this branch with Android 1.6.0 and iOS 1.5.0 delivery floors.
2. Wait for that production OTA to finish and verify it on installed apps.
3. Merge `innolope/release-native-followup-0923` into `main`. It restores both
   deferred changes and includes the Android Clipboard null guard from #3325.
   The main-push native workflow detects the changed fingerprint and starts
   coordinated iOS TestFlight and Android Play internal builds. Manual store
   review and production promotion remain separate.

Keep the native PR in draft until step 2 is complete. Its review base is the OTA
branch so the deferred code is visible in isolation; retarget it to `main` after
the OTA PR merges. Prefer a merge commit for the OTA PR to preserve ancestry;
if it is squashed, reconcile the native branch with main before retargeting.
Back-merge the resulting main history into dev after both stages to preserve
the explicit deferral and restoration history.

The native branch restores the original dev tree exactly before applying #3325
and the native trigger. New native-surface changes remain blocked by the OTA
guard until a successful native release records its baseline tag. Native and
OTA workflows share the existing production-release concurrency group.

PR #3367 is separate release-automation work. Its proposed native build after
every successful OTA conflicts with this two-stage release policy; reconcile
that trigger before combining it with either release branch. Do not merge the
original #3325 directly into the OTA branch.

The Wallet integration retains its entitlement/provisioning-profile gates.
A successful binary build alone does not establish Apple entitlement approval,
Wallet/Watch device verification, store review, or production availability.
