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
