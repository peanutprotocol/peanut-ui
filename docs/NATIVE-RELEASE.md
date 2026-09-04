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

### OS / WebView floors

The web bundle is built with Tailwind v4: ~90% of the stylesheet lives in
`@layer` (WebKit ≥ 15.4), gradients interpolate `in oklab` (≥ 16.2) and the
`@property` fallback sits inside a layer (≥ 16.4). Anything older renders an
unstyled app, so the shells pin these floors:

| Platform | Floor | Where |
|----------|-------|-------|
| iOS | **16.4** | `IPHONEOS_DEPLOYMENT_TARGET` in `ios/App/App.xcodeproj/project.pbxproj` (+ `.iOS(.v16)` in `ios/App/CapApp-SPM/Package.swift`) |
| Android | `minSdkVersion 24`, **Chrome WebView ≥ 111** | the OS is not the floor, the updatable System WebView is; the app shows an "update your WebView" screen when the boot-time CSS canary fails |

Raising the iOS floor changes the App Store's minimum OS on the next submission;
the JS canary (`isWebViewCssSupported`) is the runtime guard for devices below
either floor that still hold an older binary.

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
  - `versionName` ← `ANDROID_VERSION_NAME` env, else `package.json` `version` (a
    local-build fallback only — CI resolves it, see "Version scheme" below).
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

### Version scheme

Every shipped version is `<major>.<build>.<ota>`:

| component | means | moves when |
|-----------|-------|------------|
| `major` | app generation | a deliberate major upgrade — edit `package.json` `version`, the only place it is read from |
| `build` | native build counter | every store build; resets `ota` to 0 |
| `ota` | OTA counter within that build | every OTA on top of that binary; `.0` is the JS baked into the binary itself |

So `1.7.0` is the seventh store build and `1.7.3` is its third OTA. Two properties fall
out of the shape that used to be maintained by hand: an OTA always sorts strictly above
the binary it targets (Capgo drops anything below it — TASK-21793), and the version alone
says which binary a bundle belongs to.

**Nobody types a number.** `scripts/release-version.mjs` resolves them from git tags
(`v<major>.<build>.0`) plus the Capgo channel. That registry is deliberately not a file
in the repo: `dev` and `main` both carry a `pull_request` ruleset with no bypass actors,
so CI cannot push a version-bump commit and `package.json` cannot be the auto-bumped
source of truth. Its `version` is now only the major anchor and the local-build fallback,
and it is fine for it to lag behind what ships.

### Cutting a release

Two `workflow_dispatch` buttons, both run from `dev` (they refuse any other ref — `main`
runs well behind, and a release off the wrong ref would look correctly numbered while
shipping stale code):

| | button | what it does |
|-|--------|--------------|
| native | **Release Native** | resolves `<major>.<build+1>.0` → builds iOS + Android from that one number → TestFlight + Play `internal` → tags `v<version>` |
| OTA | **Release OTA** | resolves `<major>.<build>.<ota+1>` off the production channel → uploads the bundle → tags `ota-<version>` |

Neither is automatic: no push, merge or commit reaches them. They are the same deliberate
act as the `git tag … && git push` they replace, minus the hand-picked number.

The tag is written **after** the build, as the record of what shipped — a failed run
leaves no tag, so a re-run resolves the same number instead of burning one. CI tags with
`GITHUB_TOKEN` on purpose: GitHub does not start workflows from a push made with it, so
the tag records the release without re-triggering the build. **A PAT there would
double-build.**

Both build workflows still accept a `v*` tag push as break-glass, and validate the
version against the scheme before starting. That check is what a glob cannot do: `v*`
cannot reject `v2026.02.26` (a real tag on `main`) because it is `X.Y.Z` shaped — only
the major comparison catches it.

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

- **Trigger:** called by `release-native.yml` (§6, "Version scheme"). A `vX.Y.0` tag push and a
  manual dispatch stay as break-glass paths.
- **Flow:** checkout (submodules) → JDK 17 + Node 22 → install → decode keystore +
  write `keystore.properties` → write prod `NEXT_PUBLIC_*` → `pnpm native:release`
  (`versionCode = github.run_number`) → upload AAB to Play (`internal` by default).
- **Gate** with a `production` GitHub Environment + required reviewers — not configured
  yet: the environment has no protection rules today, so runs ship without a second
  approval (see §9, "No second approver yet").
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

`capgo-deploy.yml` builds the static export and uploads it. Production is **opt-in per
release**, never a side effect of pushing code:

| trigger                              | channel      | bundle version                    |
| ------------------------------------ | ------------ | --------------------------------- |
| **Release OTA** workflow (§6)        | `production` | `<major>.<build>.<ota+1>`         |
| merge to `dev`                       | `staging`    | `<major>.<build>.<commit count>`  |
| push tag `ota-1.1.4` (break-glass)   | `production` | `1.1.4`                           |
| manual dispatch                      | `staging` / `development` only | `<major>.<build>.<commit count>` |

Shipping an OTA to everyone is therefore two steps — land the code, then run **Release
OTA** (§6). Merging only reaches `staging`, which no production device sees. A bare manual
dispatch to `production` is refused: it would upload a staging-shaped version and drag
the production OTA counter into the commit-count band, where the next resolved version
collides with a bundle that already exists.

Staging keeps the commit count as its OTA component on purpose. Both lanes share one
bundle namespace, production counts OTAs in single digits, and a version collision
no-ops under `--version-exists-ok` — uploaded, listed, shipped to nobody.

Not `v*`: that prefix belongs to `ios-release.yml` / `android-release.yml` for native
store builds, and the two must not trigger each other.

One deliberate exception to "opt-in per release": a **native release auto-publishes a
matching production bundle** when its versionName is ahead of the newest production
bundle. Capgo refuses on-device any bundle sorting below the installed native version
(`disable_auto_update_under_native`), so a binary that outruns the bundles strands its
whole fleet with green CI — that was TASK-21793 (102 devices refused OTA for a month
because internal builds shipped 1.0.53 while the newest bundle was 1.0.51). The release
workflows check the floor before building (`scripts/semver-newer.mjs` against
`channel currentBundle production`) and, after the store upload, publish the release's
own `out/` under the binary's versionName, then assert the channel serves it.

- **The `production` channel** must exist in the Capgo dashboard and be bound to the prod
  app. It does — bundle 1.0.48 shipped to it on 2026-08-06.
- **No second approver yet.** The job declares the `Production` environment, but that
  environment has no protection rules, so the run ships immediately. Adding required
  reviewers under Settings → Environments → Production makes it queue for approval with no
  workflow change (needs repo admin).
- **Native-version gating:** every upload passes an explicit `--min-update-version`, so a
  JS bundle built against new plugins stays off older native shells. The release lanes pin
  it to the binary they ship; `capgo-deploy.yml` resolves it from the newest `v<major>.<build>.0`
  tag (`scripts/release-version.mjs native-floor`) and fails if none is visible. It replaced
  `--auto-min-update-version`, which only copies the previous bundle's floor forward — with no
  native version stamped on the `dev` checkout (package.json says 1.0.53) the floor never
  rose past the first upload, and the CLI refuses the two flags together. Capgo only enforces
  the floor when the channel's "disable auto update" strategy is set to *version number*.
  **Bump the native version whenever you change plugins/native code**, then ship that via
  Play — OTA can't.
- **Native fingerprint (the check behind that rule):** `scripts/native-fingerprint.mjs`
  hashes the JS↔native contract in three parts: the **config** (Capacitor's two generated
  plugin manifests, `capacitor.config.ts`, the gradle files, `AndroidManifest.xml`,
  `project.pbxproj`, `Info.plist`, both entitlements files), the **bridges** JS actually
  calls (`android/app/src/**.{java,kt}`, `ios/App/**.swift` — a bundle calling a new
  method on `PushProvisioningPlugin` needs the binary that has it, and no config file
  moves when that changes), and the **resolved plugin versions from `pnpm-lock.yaml`**
  (the OTA workflow runs `pnpm install` but never regenerates the committed manifests, so
  a plugin bumped without a `cap sync` would ship the new JS wrapper against unchanged
  manifest bytes). `capgo-deploy.yml` recomputes it and compares against the
  `v<major>.<build>.0` tag the bundle's floor targets; a mismatch **fails the OTA** and
  names the file that moved. It is a pure function of the tree, so nothing is stored and
  any tag can be fingerprinted retroactively (`--ref v1.2.0`). `MARKETING_VERSION` and
  `CURRENT_PROJECT_VERSION` are normalised out — `native-ios-postsync.js` stamps them on
  every sync, and leaving them in would refuse an OTA after every release.
  **Why it exists:** `min_update_version` only blocks *delivery*, only under the
  `metadata` channel strategy, and lives in a dashboard CI cannot read, so nothing
  previously reported that an incompatible bundle had been *built* — the mismatch first
  appeared on a user's device. The remedy for a failure is always to cut a native
  release, never to widen or skip the check.
- **Staged rollout:** roll production OTA to ~10% → watch Sentry/crash + error rates →
  100%. Don't 100% every merge.
- **Rollback** is configured in `capacitor.config.ts` (`appReadyTimeout: 15000` +
  `autoDeleteFailed` + `autoDeletePrevious`): a bundle that never calls
  `notifyAppReady()` auto-reverts. **Verify once** with a deliberately-broken bundle.
- **Boundary:** OTA ships web assets only. New plugins, Gradle, permissions, versionCode
  → Play release.

### Internal testing (the `staging` channel on a real device)

Every merge to `dev` already publishes to `staging`; the missing half was a way for a
tester's device to read it. Five taps on the version line in **Profile → About** reveal a
Beta-updates switch that calls `setChannel('staging')` — no dashboard work per tester, and
the row also prints the device ID for the times someone has to be forced onto a channel
from the dashboard instead.

Three prerequisites, all one-time:

- The account must be in the **`beta-ota-channel`** PostHog cohort, which is what keeps
  the switch off customer devices. Read what it is, though: a client-side flag that
  decides whether a React component renders. `setChannel` talks to Capgo directly with
  the app key shipped in every binary, and non-prod builds skip the flag entirely, so
  anyone running a modified client can self-assign regardless. It stops people who did
  not mean to be on beta, not people who do. Move the join behind the backend (verify
  the account server-side, assign the device through Capgo's API) if that ever needs to
  be a real boundary.
- `staging` must have **"Allow devices to self dissociate/associate"** enabled, or
  `setChannel()` is refused and the app says so. Changing it needs a Super Admin — and
  it is the decision that actually opens the channel: from that point any install that
  can call the plugin can join, whatever the cohort says.
- The tester's binary must not outrank the bundle: `disable_auto_update_under_native`
  makes a device on versionName 1.1.x refuse anything sorting below it. Staging's
  commit-count band sits far above production's, so this only bites right after a native
  release.

Leaving the channel unsets it **and** calls `reset()` back to the store bundle: staging
versions outrank every production one, so no production OTA could ever replace a beta
bundle on its own.

One asymmetry to know before forcing anyone from the dashboard: `unsetChannel()` is
local-only in the plugin (it drops a stored preference and returns ok), so a **dashboard
device override survives it** and Capgo keeps serving beta. The switch detects that —
it re-reads the effective channel and says an admin has to remove the override rather
than resetting into an exit that undoes itself on the next launch — but the removal is
dashboard-side. Self-assignment is the cleaner enrolment path for that reason. When Capgo
cannot be reached to answer that question, the switch refuses to reset at all and asks the
tester to retry online: only a confirmed answer licenses the reset. That attempt is recorded
in local storage **before** the channel is cleared, and the switch keeps reading as "on beta"
until the store bundle is actually the one running — otherwise a device whose channel was
cleared but whose bundle was not looks settled while running beta code that no production OTA
can replace, and the card that offers the retry would disappear for anyone outside the cohort.

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
- No `google-services.json` and no `google-services` Gradle plugin: OneSignal's Android
  SDK never reads that file. `PushRegistratorFCM` builds `FirebaseOptions` in code from its
  own baked-in defaults plus the sender ID served by the OneSignal dashboard, and
  `com.onesignal:notifications` pulls `firebase-messaging` in transitively. The plugin only
  wires Firebase's *automatic* initialization, which OneSignal bypasses.
- `scripts/native-build.js` warns when `NEXT_PUBLIC_ONESIGNAL_APP_ID` is unset (the app id
  is inlined into the static bundle; without it the native SDK can't initialize).

**Provider setup (do once, no code, dashboard only):**
1. **OneSignal dashboard** → the existing app → **Google Android (FCM)** platform →
   upload the **FCM v1 service account JSON** (Firebase → Project settings → Service
   accounts → Generate private key) and set the **Sender ID** (Firebase project number).
   This is the *only* thing Android push depends on — there is no build-side FCM config.

   Note: the file OneSignal wants here is the **service account private key**, not
   `google-services.json`. The two are different Firebase files: `google-services.json` is
   an app-side client config; the service account JSON is a server credential OneSignal
   uses to send. Uploading `google-services.json` into OneSignal will not work.

No `ANDROID_GOOGLE_SERVICES_JSON` secret is needed; it has been removed from the build.

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
