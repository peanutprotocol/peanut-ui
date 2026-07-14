# Native (iOS) — CI Release to TestFlight

How the iOS app is built, signed, and shipped to TestFlight from CI. This mirrors
the Android release pipeline (`docs/NATIVE-RELEASE.md`) but for iOS, and uses the
same **no-fastlane** style: signing material lives as CI secrets (the iOS analogue
of the Android keystore-as-secret), the build is reproducible, and the IPA lands on
TestFlight for manual App Store promotion.

> **Architecture:** Capacitor 8 wrapping a static export of the Next.js app. The iOS
> project is standard Capacitor (scheme `App`, workspace `ios/App/App.xcworkspace`,
> bundle `me.peanut.wallet`, SPM, deploy target 15.0, entitlements
> `App/App.entitlements`). `Info.plist` reads `$(CURRENT_PROJECT_VERSION)` /
> `$(MARKETING_VERSION)`.

---

## 1. The pipeline (`.github/workflows/ios-release.yml`)

- **Trigger:** push tag `vX.Y.Z`, or manual dispatch (optional `versionName` input).
- **Runner:** `macos-15`, gated by the `production` GitHub Environment (required reviewers).
- **Flow:** checkout (submodules) → Xcode `latest-stable` + Node 22 + pnpm 10 →
  `pnpm install` → write prod `NEXT_PUBLIC_*` (same block as `android-release.yml`) →
  `node scripts/native-build.js && npx cap sync ios` (+ optional
  `scripts/native-ios-postsync.js` if present) → **import cert**
  (`apple-actions/import-codesign-certs`) → **install profile** (decode the base64
  secret, read its UUID/Name, drop into `~/Library/MobileDevice/Provisioning Profiles/`)
  → **archive + export** (`xcodebuild archive` then `-exportArchive` with a generated
  `ExportOptions.plist`) → **upload** (`apple-actions/upload-testflight-build`) → IPA
  artifact (`build/ios/*.ipa`).
- **Signing:** the project default is **Automatic**; the archive step overrides it for
  that build via command-line build settings (`CODE_SIGN_STYLE=Manual`,
  `DEVELOPMENT_TEAM`, `CODE_SIGN_IDENTITY="Apple Distribution"`,
  `PROVISIONING_PROFILE_SPECIFIER`). `CURRENT_PROJECT_VERSION` is always the CI run
  number; `MARKETING_VERSION` is overridden only when `versionName` is supplied
  (`Info.plist` reads both via `$(...)`).

---

## 2. One-time setup (signing material)

CI consumes pre-made signing material — create it once from a machine with Apple
Developer access and store it as repo secrets:

1. **Distribution certificate** — in Xcode (or the Developer portal) create/obtain an
   **Apple Distribution** certificate, then export it from Keychain Access as a `.p12`
   (with a password). Base64 it:
   ```bash
   base64 -i AppleDistribution.p12 | pbcopy   # → IOS_DIST_CERT_P12_BASE64
   ```
   Store the export password as `IOS_DIST_CERT_PASSWORD`.
2. **Provisioning profile** — in the Developer portal create an **App Store** profile
   for `me.peanut.wallet` that includes the **Associated Domains** capability (it backs
   `webcredentials:peanut.me` in `App/App.entitlements` — passkeys break without it).
   Download the `.mobileprovision` and base64 it:
   ```bash
   base64 -i me_peanut_wallet_appstore.mobileprovision | pbcopy   # → IOS_PROVISIONING_PROFILE_BASE64
   ```
   The workflow reads the profile's name from the file itself — no separate name secret.
3. **App Store Connect API key** — create an API key (Admin / App Manager) in App Store
   Connect; store the issuer id, key id, and the **raw `.p8` contents** as the secrets
   below.

> **Rotation:** the distribution certificate expires ~yearly and the profile
> expires / needs re-issuing when the cert or capabilities change. When that happens,
> regenerate the cert/profile, re-export, re-base64, and update `IOS_DIST_CERT_*` /
> `IOS_PROVISIONING_PROFILE_BASE64`. (This manual step is the trade-off for not using
> fastlane `match`.)

---

## 3. Manual App Store promotion

The pipeline stops at **TestFlight** (upload is automatic). After the build finishes
processing, promote it to the App Store **manually** in App Store Connect (submit for
review) once TestFlight validation looks clean — the iOS analogue of the Play track
promotion on the Android side.

---

## 4. Required repo secrets

| Secret | What |
|--------|------|
| `ASC_KEY_ID` | App Store Connect API key id |
| `ASC_ISSUER_ID` | App Store Connect API issuer id |
| `ASC_KEY_CONTENT` | the **raw `.p8` contents** of the ASC API private key (paste the PEM, incl. `-----BEGIN PRIVATE KEY-----`) |
| `APPLE_TEAM_ID` | Apple Developer team id |
| `IOS_DIST_CERT_P12_BASE64` | Apple Distribution cert exported as `.p12`, base64-encoded |
| `IOS_DIST_CERT_PASSWORD` | password set when exporting the `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store `.mobileprovision` for `me.peanut.wallet`, base64-encoded |
| `SUBMODULE_TOKEN` | read access to the `src/content` submodule (shared with Android) |

Plus the production `NEXT_PUBLIC_*` Variables/Secrets the static export bakes in — the
`Production web env` step is identical to `android-release.yml`, so both platforms
produce the same `.env.production.local`.

---

## 5. Prerequisite — the `ios/` platform must be committed

The `ios/` Capacitor platform must exist on the branch CI builds. It currently lives
**only in the `peanut-ui-ios2` / `peanut-ui-ios` worktrees** — until `ios/` is committed
to the branch this workflow runs on, `npx cap sync ios` (and the whole job) will fail.

---

## 6. Push notifications (OneSignal / APNs)

Push is delivered through the same OneSignal app as web — the device links to the user
via `OneSignal.login(userId)`, so the existing `external_id`-targeted sequences reach
native with no backend or sequence changes. The web/native split lives behind
`src/services/onesignal/` (selected by `isCapacitor()`); the native side is
`@onesignal/capacitor-plugin`, wired into the app target's SPM by `npx cap sync ios`.

### 6a. App target — already committed
- `App.entitlements`: `aps-environment` + App Group `group.me.peanut.wallet.onesignal`.
- `Info.plist`: `UIBackgroundModes` → `remote-notification`.
- `aps-environment` is committed as `development` (local on-device debug builds use the
  APNs **sandbox**). **Release/TestFlight builds need `production`** — the App Store
  provisioning profile carries production APNs. Either flip the value before an archive
  or keep a build-config-specific entitlements file. Watch for a signing mismatch if the
  profile and entitlement environments disagree.

### 6b. Notification Service Extension (NSE) — needs a one-time Xcode step
Rich media, badge sync, and confirmed-delivery analytics require an NSE target. The
**source files are committed** under `ios/App/OneSignalNotificationServiceExtension/`
(`NotificationService.swift`, `Info.plist`, `*.entitlements`). The Xcode **target**
itself is not hand-forged into `project.pbxproj` (too error-prone to script blind). Add
it once in Xcode:

1. **File → New → Target → Notification Service Extension.** Name it
   `OneSignalNotificationServiceExtension`. Set its deployment target to **iOS 15**
   (match the app). Do **not** activate the scheme when prompted.
2. Delete Xcode's generated `NotificationService.swift` / `Info.plist` for the target and
   **add the committed files** in `ios/App/OneSignalNotificationServiceExtension/` to the
   target instead (or point the target's `INFOPLIST_FILE` / sources at them).
3. **Signing & Capabilities** for the extension target: add the **App Groups** capability
   and tick `group.me.peanut.wallet.onesignal` (same group as the app). Set
   `CODE_SIGN_ENTITLEMENTS` to the committed `*.entitlements`.
4. **Add the OneSignal extension SPM product to the *extension* target:** File → Add
   Package Dependencies → `https://github.com/OneSignal/OneSignal-iOS-SDK` → add the
   **`OneSignalExtension`** product **to the extension target only** (the app target gets
   OneSignal transitively via the Capacitor plugin — don't double-add).
5. The extension bundle id is `me.peanut.wallet.OneSignalNotificationServiceExtension`;
   create a matching **App Store provisioning profile** for it (with the App Group) and
   add it to CI signing alongside the app profile.

> After adding the target, commit the resulting `project.pbxproj` (and `Package.resolved`)
> so CI builds it. `npx cap sync ios` regenerates `CapApp-SPM/Package.swift` for the app
> target only and will **not** touch the extension target — the NSE's SPM dependency is
> managed directly on the target in Xcode.

### 6c. Provider setup (OneSignal dashboard — do once, no code)
- Create an **APNs `.p8` auth key** in the Apple Developer portal (Keys → enable Apple
  Push Notifications service). Note the **Key ID** and your **Team ID**.
- In the OneSignal dashboard → the existing app → **Apple iOS (APNs)** platform → upload
  the `.p8`, Key ID, Team ID, and bundle id `me.peanut.wallet`.
- Enable **Push Notifications** on the `me.peanut.wallet` App ID, and make sure the App
  Store provisioning profile(s) include the push entitlement.

### 6d. Verify (real device — APNs doesn't work on the simulator)
1. `node scripts/native-build.js && npx cap sync ios`, open `ios/App/App.xcworkspace`,
   run on a physical device.
2. Accept the permission prompt (surfaced via the existing `SetupNotificationsModal`),
   confirm a subscription appears under the user's `external_id` in OneSignal.
3. Send a test push with an image and confirm the NSE renders the rich notification.
