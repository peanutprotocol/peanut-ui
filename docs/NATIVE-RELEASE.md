# Native (Android) — Local Dev, Release & Play Review

How to run the app locally, build/sign/ship it, and get it through Play review.

> **Architecture:** Capacitor 8 wrapping a static export of the Next.js app — one
> codebase, web + Android (iOS in progress, see §11). Key files:
> `scripts/native-build.js`, `scripts/native-release.sh`, `capacitor.config.ts`,
> `next.config.native.js`.

---

## 1. Toolchain (must match, or builds fail)

| Tool | Version | Why |
|------|---------|-----|
| **Node** | **22.x** | `@sentry/profiling-node` ships no binary for Node 25; the API crashes on boot under 25. Use `node@22` (nvm `v22.x` or `brew install node@22`). |
| **JDK** | **17** | Capacitor-android compiles at 21; the app/AGP baseline is 17. `android/build.gradle` forces Java 17 across all modules. |
| **pnpm** | 10 | `corepack enable` |
| **PostgreSQL** | 16 (14 works locally) | backend |
| Xcode / CocoaPods | 26+ / latest | iOS only (§11) |

Clone with submodules — the build needs `src/content`:
```bash
git clone --recurse-submodules https://github.com/peanutprotocol/peanut-ui
```

---

## 2. Branches & merge order

The native work is split into focused branches. **Merge order matters** — the
build-reliability branch is a hard prerequisite:

1. **`fix/native-build-reliability`** — Java 17 force + `card-comparison.ts`
   `'use server'` removal (a Server Action breaks `output: 'export'`) + cleartext
   network config. **Without this the static export and Gradle build fail**, so it
   must land first.
2. **`fix/native-passkey-reliability`** — silent "Set it up" fix + multi-account
   signing (PR #2189 re-applied).
3. **`feat/native-review-readiness`** — reviewer/demo mode, build guard, versionCode
   wiring, plugins (haptics/keyboard), `native:release`, CI release, this doc.
4. **`peanut-api-ts` `feat/demo-reviewer-invite`** — the `demo` code + reviewer seed;
   deploy alongside #3 so reviewer access works.
5. **`feat/native-ios`** — iOS platform (in progress).

---

## 3. Run it all locally (sandbox / testnet)

### Backend → `peanut-api-ts`
```bash
# Postgres role + db (one-time). On macOS Homebrew the superuser is your user,
# not `postgres`, so: createuser/createdb directly (DATABASE_URL → peanut_dev).
npx prisma generate --sql           # needs the DB up (typed SQL client)
npx prisma migrate deploy
npx tsx scripts/seed-dev-system-users.ts
npx tsx scripts/seed-reviewer-user.ts   # seeds the `demo` → `reviewer` inviter
npx tsx scripts/seed-rails.ts           # rails — flows 400 without this
PORT=5001 pnpm dev                      # see port note below
curl localhost:5001/healthz             # {"status":"healthy","dbConnected":true}
```
**Local gotchas (this machine):**
- **Port 5000 is taken by macOS AirPlay Receiver** (`ControlCenter`). Either turn it
  off (System Settings → General → AirDrop & Handoff → AirPlay Receiver) to use 5000,
  or run on another port (`PORT=5001`) and point the app at it.
- **Run with Node 22** (`PATH="$(brew --prefix node@22)/bin:$PATH" pnpm dev`).
- **`engineering/qa/` dev-cheat imports**: `src/routes/dev/cheats.ts` dynamically
  imports a QA harness that only exists in the full monorepo. In a standalone
  checkout, drop stub `.mjs` files at `../engineering/qa/lib/{factories/*,zerodev}.mjs`
  so esbuild resolves them (the `/dev/cheats` endpoints are unused by the demo flow).
- **`PERK_WALLET_PRIVATE_KEY`** must be set in `.env` (startup inits a perk-wallet
  cache). A dummy `0x`+64-hex key is fine for local.

### App → Android emulator against the local backend
The native shell talks to `NEXT_PUBLIC_BASE_URL` (defaults to prod `peanut.me`). To
hit the **local** backend from the emulator, build with the host alias `10.0.2.2`:
```bash
# peanut-ui/.env.production.local
NEXT_PUBLIC_BASE_URL=http://10.0.2.2:5001
NEXT_PUBLIC_PEANUT_API_URL=http://10.0.2.2:5001
NEXT_PUBLIC_NATIVE_RP_ID=peanut.me
NEXT_PUBLIC_CAPACITOR_BUILD=true
```
Cleartext to `10.0.2.2`/`localhost` is already permitted (`network_security_config.xml`
+ manifest, on `fix/native-build-reliability`; scoped so production https is untouched).
```bash
node scripts/native-build.js
npx cap sync android
npx cap run android --target <emulator-id>     # or: cd android && ./gradlew assembleDebug && adb install -r <apk>
```
> **Debug-build passkey caveat:** passkey registration verifies the app's signing
> cert against `peanut.me/.well-known/assetlinks.json`. A local **debug** keystore is
> usually not among the listed fingerprints, so passkey creation may fail on the
> emulator. The landing/ribbon and the `demo` invite validation work regardless; for
> full passkey flow use a build signed with a registered key.

---

## 4. Reviewer access (the May-18 rejection fix)

Invite-only + passkey-only is why the reviewer's access "didn't work". There's now a
**reviewer/demo mode** entered with a single code.

- Reviewer enters invite code **`demo`** → backend maps it to the `reviewer` inviter
  (`PROD/STAGING_SPECIAL_INVITE_CODES_MAP` in `peanut-api-ts/src/utils/invite.ts`).
- The native client recognizes `demo` (`src/utils/reviewer.ts`) and: overlays
  pre-filled balance + history (no empty states), **skips KYC**, and **simulates**
  send/pay/withdraw (no real funds / on-chain tx — safe on mainnet).
- The reviewer still creates a **real passkey** — the core mechanic review needs to see.

**Seed the inviter** per environment (idempotent; localhost self-heals):
```bash
npx tsx scripts/seed-reviewer-user.ts   # in peanut-api-ts, DATABASE_URL → target env
```
**Play Console → App content → App access:** declare restricted, instructions: "Enter
invite code `demo`, tap Continue, create a passkey when prompted; you'll land on a
populated demo wallet. No username/password." (Passwordless — the code is the access.)

---

## 5. Passkey reliability fixes (`fix/native-passkey-reliability`)

- **Silent "Set it up":** `passkeyPreflight.ts` now queries the native plugin's
  `isSupported()`; `SetupPasskey.tsx` re-checks on tap and always surfaces an
  actionable message — the button can never silently no-op.
- **Multi-account signing:** native signing is pinned to the kernel's own credential
  (`native-webauthn.ts` + `kernelClient.context.tsx`). **Smoke-test on a 2-account
  device** before relying on it.

---

## 6. Build the release

```bash
pnpm native:release        # derive version → native-build → cap sync → bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
- **Anti-rot guard:** `native-build.js` fails loudly if a new server-only route
  (route handler / `force-dynamic`) isn't in `ITEMS_TO_DISABLE`. Fix = add it there
  (web-only) or give the page `generateStaticParams`.
- **Versioning** (`android/app/build.gradle`, zero manual edits):
  - `versionName` ← `ANDROID_VERSION_NAME` env, else `package.json` `version`.
  - `versionCode` ← `ANDROID_VERSION_CODE` env, else git commit count; floored at 2
    (rejected first upload was code 1). CI passes `10000 + github.run_number`.
  - **CI is the only authoritative versionCode source.** Local builds derive the code
    from git commit count, which can collide with or fall behind codes already on Play
    (Play rejects duplicates and non-increasing codes). Never upload a locally built
    AAB; use the workflow.
- Overrides: `ANDROID_VERSION_NAME=1.0.0 ANDROID_VERSION_CODE=9000 pnpm native:release`.
- **Headers note:** `vercel.json` headers (CSP, HSTS, …) apply to the Vercel web
  deployment only — the native static export is served from the app bundle and ships
  no HTTP headers, so nothing there affects (or protects) the WebView.

---

## 7. Signing, keystore & secret management

**Play App Signing is enabled** → Google holds the real signing key; the local
keystore is only the **upload** key. A loss is recoverable (upload-key reset, ~days);
a leak is bounded by Play review + account 2FA. Still treat it as a secret.

- **Store it in a team secret manager** (1Password/Vault/cloud Secret Manager):
  the keystore **base64-encoded** + `storePassword` / `keyPassword` / `keyAlias`.
  Never in git, Slack, or a single laptop.
- **Recovery:** Play Console → App integrity → request upload-key reset, then upload a
  new upload certificate. Document who can do this.
- **Passkey coupling:** users get the binary re-signed with the **Play App Signing**
  cert, so that SHA-256 must be in `public/.well-known/assetlinks.json` (3 fingerprints
  listed — confirm the Play App Signing one is present). **Rotating keys requires
  updating `assetlinks.json` or passkey sign-in breaks.**
- **rpId sync set:** the passkey rpId (`peanut.me`) is hardcoded in several places that
  must change together — a miss breaks passkey creation silently:
  1. `capacitor.config.ts` (`CapacitorPasskey.origin` / `domains`)
  2. `android/app/src/main/res/values/capacitor-passkey.xml` (asset-statements URL)
  3. `.github/workflows/android-release.yml` (`NEXT_PUBLIC_NATIVE_RP_ID`)
  4. `public/.well-known/assetlinks.json` (served from the rpId domain)
- Local signing reads `android/keystore.properties` (gitignored):
  ```properties
  storeFile=../peanut-release.keystore
  storePassword=…
  keyAlias=peanut
  keyPassword=…
  ```

---

## 8. CI release pipeline (`.github/workflows/android-release.yml`)

Removes the "release only builds on one laptop" gap — keystore lives as CI secrets,
the build is reproducible, the AAB lands on a Play track.

- **Trigger:** push tag `vX.Y.Z`, or manual dispatch (pick a track).
- **Flow:** checkout (submodules) → JDK 17 + Node 22 → install → decode keystore +
  write `keystore.properties` → write prod `NEXT_PUBLIC_*` → `pnpm native:release`
  (`versionCode = github.run_number`) → upload AAB to Play (`internal` by default).
- **Gate** with a `production` GitHub Environment + required reviewers.
- **Track promotion:** internal → closed/beta → production with **staged rollout**
  (`status: inProgress` + `userFraction: 0.1`, promote after metrics look clean).

**Required repo secrets:**

| Secret | What |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 peanut-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | signing creds |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play Developer API service account (least-priv "Release manager") |
| `ANDROID_GOOGLE_SERVICES_JSON` | `base64 -w0 google-services.json` — **optional**; OneSignal push does not read it (see §Android push) |
| `SUBMODULE_TOKEN` | read access to the `src/content` submodule |
| `CAPGO_API_KEY` | OTA (already used by `capgo-deploy.yml`) |
| prod `NEXT_PUBLIC_*` | the values the static export bakes in (OneSignal, Sentry, chain, …) |

> Housekeeping: the secret is named `NEXT_PUBLIC_SENTRY_DSN` but a Sentry DSN is public
> by design (it ships in every web bundle) — the `secrets.*` storage is convention, not
> confidentiality. If renaming to `SENTRY_DSN` for clarity, update the reference in
> `android-release.yml` in the same change or builds bake an empty DSN.

> Prereq: `fix/native-build-reliability` must be merged or `native:release` won't build.

---

## 9. OTA updates (Capgo)

`capgo-deploy.yml` builds the static export and uploads on push: `main` → `production`,
`dev` → `staging`; manual dispatch picks the channel.

- **Configure the `production` channel** in the Capgo dashboard and bind it to the prod
  app (the workflow pushes to it; the channel must exist).
- **Native-version gating:** `--auto-min-update-version` (already set) keeps a JS bundle
  built against new plugins off older native shells. **Bump the native version whenever
  you change plugins/native code**, then ship that via Play — OTA can't.
- **Staged rollout:** roll production OTA to ~10% → watch Sentry/crash + error rates →
  100%. Don't 100% every merge.
- **Rollback** is configured in `capacitor.config.ts` (`appReadyTimeout: 15000` +
  `autoDeleteFailed` + `autoDeletePrevious`): a bundle that never calls
  `notifyAppReady()` auto-reverts. **Verify once** with a deliberately-broken bundle.
- **Boundary:** OTA ships web assets only. New plugins, Gradle, permissions, versionCode
  → Play release.

---

## 10. Pre-submission verification

1. Local stack up (backend + seeds), `demo` validates.
2. `pnpm native:release` produces a signed AAB with `versionCode ≥ 2`.
3. Reviewer-mode E2E on a device: invite `demo` → passkey → Home/History show demo data
   → KYC skipped → a send reaches a simulated success (no on-chain tx).
4. Passkey silent-failure: no Google account / outdated Play Services → actionable error,
   never a no-op.
5. Multi-account smoke test: two accounts on one device → both sign valid signatures.
6. `pnpm test:unit:ci` green; `pnpm typecheck` clean.

---

## 11. Push notifications (OneSignal / FCM)

Push is delivered through the same OneSignal app as web — the device links to the user
via `OneSignal.login(userId)`, so existing `external_id`-targeted sequences reach native
with **no backend or sequence changes**. The web/native split lives behind
`src/services/onesignal/` (selected by `isCapacitor()`); native uses
`@onesignal/capacitor-plugin`, autolinked into Gradle by `npx cap sync android`.

**Already wired (committed):**
- `@onesignal/capacitor-plugin` in `package.json`; the plugin's FCM/OneSignal Gradle
  deps autolink on `cap sync`.
- `AndroidManifest.xml`: `POST_NOTIFICATIONS` (the Android 13+ runtime prompt, driven by
  the plugin's `requestPermission()`).
- `android/app/build.gradle` already conditionally applies the `google-services` plugin
  **only when `google-services.json` is present** — its absence disables push but never
  fails the build.
- `scripts/native-build.js` warns when `NEXT_PUBLIC_ONESIGNAL_APP_ID` is unset (the app id
  is inlined into the static bundle; without it the native SDK can't initialize).

**Provider setup (do once, no code):**
1. **Firebase:** create/locate the Firebase project for `me.peanut.wallet`, download
   `google-services.json`, place it at `android/app/google-services.json` (gitignored).
2. **OneSignal dashboard** → the existing app → **Google Android (FCM)** platform →
   upload the **FCM v1 service account JSON** (Firebase → Project settings → Service
   accounts → Generate private key).
3. **CI:** `ANDROID_GOOGLE_SERVICES_JSON` is **optional** and currently unset. OneSignal's
   Android SDK never reads `google-services.json`: `PushRegistratorFCM` builds
   `FirebaseOptions` in code from its own baked-in defaults plus the sender ID served by
   the OneSignal dashboard, and `com.onesignal:notifications` pulls `firebase-messaging`
   in transitively. The `google-services` Gradle plugin only wires up Firebase's
   *automatic* initialization, which OneSignal bypasses. Set the secret only if a future
   dependency needs that path; the workflow validates the file when present and skips it
   when absent.

   Android push therefore depends on the **dashboard** config in step 2, not on this file.

**Verify (real device/emulator with Play Services):**
`node scripts/native-build.js && npx cap sync android && ./gradlew assembleDebug`, install,
accept the prompt (surfaced via the existing `SetupNotificationsModal`), confirm a
subscription appears under the user's `external_id` in OneSignal, then send a test push.

---

## 12. iOS release

The iOS release pipeline (`.github/workflows/ios-release.yml`) is maintained on its own
branch (`feat/ci-ios`), separate from this Android runbook. It mirrors the Android lane's
no-fastlane style: an Apple Distribution cert + App Store provisioning profile stored as
CI secrets, `xcodebuild` archive/export, and upload to TestFlight via
`apple-actions/upload-testflight-build`.

See **`docs/NATIVE-RELEASE-IOS.md`** (on `feat/ci-ios`) for the full iOS pipeline,
one-time signing-material setup, secrets table, and manual App Store promotion.

---

## 13. Play submission

- Upload to a **closed/internal** track first; dogfood the reviewer flow end-to-end.
- Re-check Data safety, permissions (camera for QR/KYC), content rating, and the App
  access instructions in §4.
- Promote to **production** review only after the internal track passes.
