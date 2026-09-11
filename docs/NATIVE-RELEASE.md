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

The About screen shows this three-part version of the code currently running: the native
version for the built-in bundle, or the Capgo bundle version after an OTA. The platform
build identifier (`versionCode` / `CFBundleVersion`) remains separate support metadata;
it is not appended as a fourth dotted segment because it is not a comparable release.

**Nobody types a number.** `scripts/release-version.mjs` resolves them from git tags
(`v<major>.<build>.0`) plus the Capgo channel. That registry is deliberately not a file
in the repo: `dev` and `main` both carry a `pull_request` ruleset with no bypass actors,
so CI cannot push a version-bump commit and `package.json` cannot be the auto-bumped
source of truth. Its `version` is now only the major anchor and the local-build fallback,
and it is fine for it to lag behind what ships.

### Cutting a release

> **Owed to the next native release: the `/app` App Links claim.**
> `d91ea7cee` added `/app` + `/app/*` to `public/.well-known/apple-app-site-association`
> and `/app` + `/app/` to `android/app/src/main/AndroidManifest.xml`. `v1.6.0` predates
> that commit, so no shipped binary or AASA ever carried the claim — but the manifest half
> moved the native fingerprint, and `check-native-ota-surface` compares that fingerprint
> against the binary an OTA targets. The two lines therefore blocked every production
> bundle while delivering nothing, with the fleet stuck on JS older than its own binary.
> Both platforms were reverted together so the iOS↔Android parity case in
> `src/utils/__tests__/app-links.test.ts` stays enforced; only the two `/app`-presence
> cases are `it.skip`.
>
> **Restore all three in the PR that cuts the next native release** — the AASA entries, the
> manifest entries, and the two skipped cases. Never restore them on `dev` alone: an intent
> filter cannot ship over the air, so on their own they block OTA again for no user-visible
> gain. `native-routes.ts` still maps `/app/*` → `/app`, so nothing else needs touching.

The two **native** workflows are manual and accept `dev`, `main`, and
`release/android-kyc`. Select the source branch before dispatch — a supported branch name
does not prove that its current commit is ready to ship.

**App Release OTA is not one of them.** It runs itself on every push to `main` and refuses
every other ref, so a production OTA is not dispatched at all: merging to `main` ships it
(§9). Nothing below about selecting a branch applies to that lane.

1. Inspect the selected branch's current commit and confirm its release QA is complete.
2. Before dispatching from `main`, verify it contains the reviewed native changes and
   completed KYC fixes. A workflow change alone does not include those fixes.
3. Before integrating `release/android-kyc`, compare it with current production and
   preserve later production fixes. This branch started from an older OTA commit.
4. Complete the reviewed back-merge into `dev` and production release into `main`
   before using `main` for those fixes. Never replace the newer tree with the older OTA tree.

Use the workflow that matches the release:

| | button | what it does |
|-|--------|--------------|
| native | **App Release Android & iOS** | resolves `<major>.<build+1>.0` → builds iOS + Android from that one number → TestFlight + Play `internal` → tags `v<version>` |
| Android replacement | **App Release Android** | leave `versionName` blank on the selected supported branch → rebuilds the current tagged Android version with a new Play `versionCode`; refuses iOS/shared native changes and does not move the shared OTA floor |
| OTA | *(no button — merge to `main`)* | **App Release OTA** fires on the push: resolves `<major>.<build>.<ota+1>` off the production channel → uploads the bundle → tags `ota-<version>` |

The two native lanes are not automatic: no push, merge or commit reaches them. They are the
same deliberate act as the `git tag … && git push` they replace, minus the hand-picked
number. The OTA lane is the opposite by design — see §9 for why, and for the `Production`
environment reviewers that put a human back in front of it if you want one.

Use the Android replacement lane only for an Android-only native correction to the
currently shipped build. It verifies the existing native tag attests both platforms,
checks that every native input changed since that tag is an explicitly
legacy-compatible Android packaging input, and keeps the existing native
`versionName`. Today that allowlist contains only `android/app/proguard-rules.pro`;
plugin manifests, native bridges, dependencies, resources, permissions, and build
configuration all require **App Release Android & iOS**. That narrow rule matters because Capgo
cannot distinguish an original Android 1.5.0 install from its replacement: both must
continue to accept the same JS bundle. Advancing the shared native version for Android
alone would instead make the production Capgo minimum strand the older iOS binary.

After Play accepts a replacement AAB, a separate credentialless job records an
annotated `android-v<version>-replacement-<commit>` tag. The production build job keeps
read-only repository access; only this small post-release job receives `contents:
write`, and its only write is that tag. Future OTA checks accept the tag only when it is
annotated, is an ancestor of the bundle commit, fingerprints the tagged native surface,
and differs from the original `v<version>` tag only by the legacy-compatible allowlist.
The attestation prefix versions that fingerprint contract: existing `v2` tags retain
the original combined dependency digest, while new replacement jobs write `v3` with
the platform-split dependency manifest.
The attestation also names the `android-capacitor-permissions-v1` JavaScript guard.
While the floor still includes original Android 1.5.0 binaries, every OTA scans all
shipped source: direct Capacitor `checkPermissions` / `requestPermissions` calls are
forbidden, `@capacitor/camera` may only be loaded by the iOS preflight wrapper, and that
wrapper must return on Android before the lazy import. This prevents a later JS-only
change from reintroducing the native crash on the original same-version population.
Adding a new permission-bearing plugin changes the native fingerprint and is rejected
independently. Any native drift or legacy-permission violation blocks OTA. The guard is
retired naturally when a coordinated native release advances the shared floor beyond
the original binary. The tag is created after the Play upload, so a failed or
never-launched replacement cannot prematurely relax the OTA guard.

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

### Android release optimization

Release builds use R8 code shrinking, optimization and obfuscation, plus resource
shrinking. Capacitor supplies consumer keep rules for its plugins; app-specific
rules preserve the reflected Google Pay callback and resources loaded by name
(`mea_config` and the OneSignal notification icon). Keep any additional rules narrow:
blanket package keeps can prevent meeting Google Play's optimization thresholds.
The Android workflow also inspects the optimized DEX and refuses to upload when
`CameraPlugin` has lost its runtime permission annotation or nested permission data.

For the first optimized release:

1. Build with the normal release credentials so the MeaWallet SDK is included.
   Resolve R8 errors using the relevant SDK's consumer rules; do not globally disable
   shrinking/obfuscation or suppress all missing-class warnings.
2. Upload to Play internal testing and inspect that exact version in App Bundle
   Explorer. Confirm obfuscation, optimization and shrinking each meet the required
   25% threshold (for apps with more than 10 MB of DEX code).
3. Test the Play-installed release: startup, login/passkeys, biometric unlock,
   identity verification/camera, Google Pay provisioning and its return callback,
   push notification icon/tap routing, deep links, support chat and OTA updates.
   A debug build does not exercise R8.
4. Retain `android/app/build/outputs/mapping/release/mapping.txt` with the exact
   released AAB. CI archives the mapping directory before uploading to Play; download
   it for long-term retention before GitHub artifacts expire. AGP also embeds the
   mapping in the AAB for Play. Use the matching mapping with Android's Retrace for
   obfuscated native stack traces. This workflow does not upload native mappings to
   Sentry, so automatic Sentry deobfuscation still needs a separate integration.

References: [R8 configuration](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
and [Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en).

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
  yet: the environment has no required reviewers today, so runs ship without a second
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
| `CAPGO_API_KEY` | OTA (used by the `App Release OTA` workflow) |
| prod `NEXT_PUBLIC_*` | the values the static export bakes in (OneSignal, Sentry, chain, …) |

> Housekeeping: the secret is named `NEXT_PUBLIC_SENTRY_DSN` but a Sentry DSN is public
> by design (it ships in every web bundle) — the `secrets.*` storage is convention, not
> confidentiality. If renaming to `SENTRY_DSN` for clarity, update the reference in
> `android-release.yml` in the same change or builds bake an empty DSN.

> Prereq: `fix/native-build-reliability` must be merged or `native:release` won't build.

---

## 9. OTA updates (Capgo)

`App Release OTA` builds the static export and uploads it. **Merging to `main` ships it** —
production is not opt-in per release, and `main` is the only ref it will ship from:

| trigger                                      | channel      | bundle version                   |
| -------------------------------------------- | ------------ | -------------------------------- |
| **App Release OTA** — every push to `main`   | `production` | `<major>.<build>.<ota+1>`        |
| **App Staging OTA** — dispatch, `dev` source | `staging`    | `<major>.<build>.<commit count>` |

Shipping an OTA to everyone is therefore one step: merge to `main`. A dispatch is available
for re-running a failed ship and is guarded to `main` exactly like the push trigger —
selecting another branch is refused, not silently honoured. Anything not ready for every
install stops at `dev`, where **App Staging OTA** publishes it to a channel no production
device sees. There is no automatic staging publish and no `ota-*` break-glass workflow.

### Why the trigger is a push and not a dispatch

It replaces "a human picks a ref at dispatch time", which is what shipped bundle 1.6.1 from
a `main` two days behind the v1.6.0 release. Two refs both looked shippable and the older
one was selected — three times in one evening, the last of them a `main` dispatch made a
minute after the fix had merged to `dev`.

Automatic means automatic: the `deploy` job declares the `Production` environment, which
has a branch allowlist but **no required reviewers**, so a merge reaches every install with nobody approving
it. Adding required reviewers under Settings → Environments → Production restores a human
gate with no workflow change, and is the recommended pairing for this trigger.

One path still publishes a production bundle from a non-`main` ref: a **native release**
auto-publishes its matching bundle (below), and `release-native.yml` accepts `dev`,
`main` and `release/android-kyc`. Deliberately unchanged here — releases are cut from
`dev` today — but it means `dev` code can still reach production that way, and it should
be a conscious decision rather than a leftover.

### Per-platform delivery floors

One release tag names two binaries, and the field does not keep them in step: TestFlight
has no auto-update, so iOS sat on **1.5.0** while Android moved to **1.6.0** — and every
native input that changed between those releases was under `android/`. A version number
cannot express that. Read numerically, bundle 1.6.x "needs a 1.6 binary" and the entire
iOS population is refused JS its binary runs perfectly, *silently*, because the store row
is hidden while the App Store listing is not live.

`scripts/ota-platform-floor.mjs` answers it from the surface instead. Per platform it
walks the `v<major>.<build>.0` tags newest-first while that platform's half of the
fingerprint is unchanged; the last release that still matches is the floor — the oldest
binary of that platform whose native contract is the one this tree was built against. For
the tree above that is `android 1.6.0, ios 1.5.0`.

- **`shared` inputs count for both platforms.** `capacitor.config.ts`, `patches/` and
  cross-platform plugin versions describe the native half of both. Platform runtime
  packages are separate inputs (`@capacitor/android` for Android and `@capacitor/ios` for
  iOS), so bumping one cannot raise the unaffected platform's floor. Every fingerprint
  input declares `android`, `ios` or `shared`, and the suite fails if a new input omits the
  classification.
- **Contiguous from the newest.** A native change made and then reverted does not make the
  binaries in between able to run this JS — they are precisely the binaries the change was
  made for.
- **The floors only ever widen delivery.** The publish gate is unchanged: a tree whose
  surface differs from the newest release still fails `check-native-ota-surface` and still
  needs a coordinated native release.
- **The server gets the lower of the two.** Capgo carries one `min_update_version` per
  bundle and one bundle serves both platforms, so `--min-update-version` is the permissive
  bound and the device applies its own platform's.

#### The floors travel with the candidate, not with the running bundle

A device has to judge the bundle it is being *offered*, and the floors baked into the
bundle it is *running* are the wrong numbers for that: a candidate built after a native
release has a higher floor than anything the running JS knows about, so trusting the local
value accepts JS the binary cannot execute. Nothing in Capgo's `LatestVersion` carries
`min_update_version` — but `comment` is round-tripped from the upload onto the
`getLatest()` result (verified in both native implementations), so the publish step writes
the numbers there:

```
<sha> — <commit subject> [ota-floors: android=1.6.0 ios=1.5.0]
```

`parseCandidateFloors` reads that marker **anchored to the end of the comment**, and
nothing looser: both platforms or neither, plain `X.Y.Z` only. The anchor is load-bearing.
The comment also carries the commit subject — arbitrary text a contributor writes — and an
unanchored match let a subject reading `fix: ota-floors: android=9.9.9 ios=9.9.9 was wrong`
win over the real numbers appended after it. A floor of `9.9.9` refuses every bundle on
every binary, so that is fleet-wide OTA death by commit message. The lane always appends
its marker last; `$` is what guarantees the lane's numbers are the ones read.
`scripts/__tests__/ota-floor-marker-contract.test.js` executes the contract rather than
restating it — the workflow's own shell builds the string and the app's own regex reads it,
so the two cannot drift.

A bundle whose comment has no marker falls back to comparing the candidate's own version,
which is the conservative direction. The production OTA lane uploads to `ota-candidate`
first. It creates or updates that reserved channel with public/default access, self-assignment,
and every device audience disabled, then reads those settings back before uploading. The
Capgo key needs channel creation/settings permission for this step; missing permission
fails the run before production changes.

`scripts/capgo-release-guard.mjs` reads structured Capgo API records and selects the exact
`name` field. The pinned CLI's human bundle table does not expose comments and cannot be
used for this check. Its first production read also requires `rolloutEnabled: false`, so an
active or unverifiable alternate rollout stops the resolve job before any upload or channel
mutation. Promotion assigns the verified stable bundle and `rolloutEnabled: false` in one
channel mutation, then reads the state back; this prevents a rollout started after preflight
from surviving the promotion. Before promotion, the guard requires the expected candidate
marker at the end of that record's comment, the shared minimum native version, a link to
the full source commit, and artifact metadata. HTTP errors, malformed responses and
missing metadata stop the run. Uploads must finish successfully in that run: the production OTA
lane no longer uses `--version-exists-ok`, because a failed upload can leave a record before
its bytes are available. Version collisions require investigation, including interrupted
candidate uploads; never delete or overwrite a served bundle to bypass this guard.

Only then does the workflow point `production` to the verified version, and it reads back
the production channel and artifact before tagging. Failed pre-promotion verification
leaves production on its prior bundle. This is publication validation, not evidence that the bundle boots on
real devices; the staging and device recovery checks remain necessary.

**The floors are kept next to the staged bundle id.** A bundle is admitted at check time,
when the comment is in hand, but applied on a *later launch* — and the plugin's queue
carries only an id and a version (`BundleInfo` has no comment field). Without that, the
launch-time gate re-asks with nothing to answer from, falls back to the version rule, and
disarms the bundle the check just approved: an iOS 1.5.0 install would download 1.6.3 and
throw it away on every launch. Only one bundle is ever queued, so it is one entry, replaced
before native queueing on each stage and dropped when the queue is. A mismatched id reads
as "no floors", which is also what a bundle staged before any of this existed gets.

The scan that produces a floor **stops at the major boundary**, even where the surface
matches across it. A major is a deliberate app-generation break: `release-version.mjs`
keeps a bundle's floor inside one major band, and the on-device comparison checks majors
before builds — so a floor of `1.6.0` published from a `2.x` tree would have every `1.6`
binary accept a `2.x` bundle.

The baked `NEXT_PUBLIC_OTA_FLOOR_*` constants stay, for the one question they can answer
honestly — `runningBundleOutranksBinary()`, "is this install running JS built for a native
contract it does not have", which is what the store row should reflect whether or not a new
bundle exists.

#### Two limits to know

1. **A pre-floor install cannot be rescued over the air.** A device running a bundle that
   has the gate but no floor-reading code judges candidates by version alone, so an iOS
   1.5.0 install on bundle 1.6.2 refuses every 1.6.x — including the bundle that would
   teach it about floors. Nothing shippable reaches it; it needs a new binary (TestFlight,
   no review). The window was one bundle wide, between #3085 landing and this change, and
   it is the concrete argument for **two production channels, one per platform**
   (`--ios` / `--android` targeting, each with its own `min_update_version`): iOS would
   have stayed on a 1.5.x line and never met a 1.6.x candidate at all.
2. **The native release lanes bake and emit no floors.** At the point
   `android-release.yml` / `ios-release.yml` publish their matching bundle, the release's
   own tag does not exist yet, so floors cannot be resolved against it. Those bundles fall
   back to the candidate-version rule, so a platform the release did not touch can stay
   frozen until the next OTA from `main` carries floors.

### Provenance: the ref must contain the newest native release

Both release workflows assert that the selected commit contains the newest attested
`v<major>.<build>.0` release across all majors, before anything is built. Release tags must
be annotated with the exact `Native release X.Y.0` subject written by `release-native.yml`;
this recognizes the existing 1.1.0–1.6.0 releases and excludes unrelated date/snapshot tags.
The checked-out package major never hides a newer release. The native workflow permits an
empty registry explicitly via `newest-native --allow-none`; Git, shallow-history and
resolver failures abort instead of being treated as the first release.

Neither version-numbering mode proves ancestry on its own: `ota` lands the next bundle inside the newest native build's range and `native` returns
`latestBuild + 1`, so **both produce a number that outranks the binary whether or not the
commit contains it**. A bundle numbered above the binary is accepted by every device, and
an OTA carrying pre-release code is therefore a silent downgrade of the JS the binary
shipped with; a store build in that state is worse, since only another store release
undoes it.

This is not hypothetical. On **2026-09-10** production bundle `1.6.1` was published from
`ff3489650` — the tip of `main`, which did not yet contain the `v1.6.0` release cut from
`dev` the day before. Every install on the 1.6.0 binary took it and ran JS older than its
own. Two things had to line up:

- **`main` lagged `dev`**, so the code was old. The routine fix is a back-merge (§ release
  flow); the guard now names it as the remedy instead of leaving the operator to work it
  out from a fingerprint diff.
- **The bundle shipped through a tag push at that old commit.** A `push`-triggered workflow
  runs the workflow file **as it existed at the pushed ref**, so `ota-1.6.1` ran the
  long-retired `capgo-deploy.yml` still present at `ff3489650` — with no floor check, no
  surface check and `--auto-min-update-version`. Retiring a workflow on `dev`/`main` does
  **not** retire it at older commits, and the same trap applies to the `v*` prefix. Treat
  every `ota-*` / `v*` tag push as running last month's pipeline, and ship through the
  current main-push OTA and manual native workflows instead.

`check-native-ota-surface.mjs` already asserted the same ancestry, but only as a
precondition of its fingerprint diff — in the deploy job, after a full install and native
build, and reported as `v1.6.0 is not an ancestor of HEAD`. The explicit guard fails in
seconds and says what the consequence would have been. A stale ref whose native surface
happened to match would have passed the fingerprint diff entirely.

A second path publishes to `production` without a merge to `main`: a **native release
auto-publishes a matching production bundle** when its versionName is ahead of the newest
production bundle. `release-native.yml` accepts `dev`, `main` and `release/android-kyc`, so
this is also how `dev` code can still reach production — see the note under "One release
line" above. Capgo refuses on-device any bundle sorting below the installed native version
(`disable_auto_update_under_native`), so a binary that outruns the bundles strands its
whole fleet with green CI — that was TASK-21793 (102 devices refused OTA for a month
because internal builds shipped 1.0.53 while the newest bundle was 1.0.51). The release
workflows check the floor before building (`scripts/semver-newer.mjs` against
`channel currentBundle production`) and, after the store upload, publish the release's
own `out/` under the binary's versionName, then assert the channel serves it.

- **The `production` channel** must exist in the Capgo dashboard and be bound to the prod
  app. It does — bundle 1.0.48 shipped to it on 2026-08-06.
- **No second approver yet.** The job declares the `Production` environment, but that
  environment has no required reviewers, so the run ships immediately. Adding required
  reviewers under Settings → Environments → Production makes it queue for approval with no
  workflow change (needs repo admin).
- **Native-version gating:** every upload passes an explicit `--min-update-version`, so a
  JS bundle built against new plugins stays off older native shells. The release lanes pin
  it to the binary they ship; `App Release OTA` uses the lower verified platform floor
  (`scripts/ota-platform-floor.mjs --lowest`) and fails if no compatible release is visible.
  It replaced `--auto-min-update-version`, which only copies the previous bundle's floor forward — with no
  native version stamped on the `dev` checkout (package.json says 1.0.53) the floor never
  rose past the first upload, and the CLI refuses the two flags together.
  **Bump the native version whenever you change plugins/native code**, then ship that via
  Play — OTA can't.

  Capgo enforces that floor only under the channel's `metadata` "disable auto update"
  strategy. The production channel was not on it, and the default (`major`) reads a
  `<major>.<build>` bump as a permitted minor: a v1.6.0 native release auto-published its
  matching 1.6.0 bundle and every install on the 1.5.0 binary downloaded it, staged it and
  offered a restart — a restart that installs JS built against the newer binary's native
  surface. Set it once, per channel, with repo-admin Capgo credentials:

  ```
  npx @capgo/cli@8.42.4 channel set production --disable-auto-update metadata --apikey "$CAPGO_API_KEY"
  npx @capgo/cli@8.42.4 channel set staging --disable-auto-update metadata --apikey "$CAPGO_API_KEY"
  ```

  Deliberately not written by CI: the strategy is one fleet-wide switch, and a wrong value
  takes OTA out for everyone — the TASK-21793 shape. It is an operator decision, made once.
- **Native-version gating, on the device:** `src/utils/ota-native-gate.ts` re-derives the
  same rule client-side, because the dashboard strategy above is invisible to both CI and
  the app and nothing on the device noticed when it was wrong. Under the
  `<major>.<build>.<ota>` scheme a bundle's first two segments name the binary it was built
  against, so a bundle whose `<major>.<build>` outranks `App.getInfo().version` is never
  downloaded, never staged, and reported as store-update-required instead. A bundle already
  sitting in the plugin's queue is *disarmed* rather than hidden — `installNext()` runs from
  `appMovedToBackground()` with no JS involved, so hiding it would not stop it installing.
  The disarm points `next` back at the running bundle, which is the entry `installNext()`
  skips (there is no JS-reachable clear-next, and `setBundleError` needs a config flag no
  shipped binary sets); `builtin` is the fallback when the running bundle's id cannot be
  read. It is verified by re-reading the queue, and an unconfirmed disarm is reported at
  error level under `[capgo-apply]`, because a rewrite that silently failed leaves the
  unsafe bundle installing on the next background. The sentinel it leaves behind persists —
  `NEXT_VERSION` is cleared only when a *different* bundle installs — so a queue entry
  naming the running bundle is never read back as an update.
  It fails **open** on a version either side cannot parse: refusing every update on an
  off-scheme version is the worse of the two failures.
- **Native fingerprint (the check behind that rule):** `scripts/native-fingerprint.mjs`
  hashes the JS↔native contract in three parts: the **config** (Capacitor's two generated
  plugin manifests, `capacitor.config.ts`, the gradle files, `AndroidManifest.xml`,
  `project.pbxproj`, `Info.plist`, both entitlements files), the **bridges** JS actually
  calls (`android/app/src/main/**.{java,kt}`, `ios/App/**.swift` — a bundle calling a new
  method on `PushProvisioningPlugin` needs the binary that has it, and no config file
  moves when that changes), the **resource contracts** those config files delegate to
  (`android/app/src/main/res/**.xml`, including the `capacitor-passkey.xml` asset
  statement, and every `Info.plist`/`.entitlements` under `ios/App` — the extensions'
  as well as the app's), and the **resolved plugin versions from `pnpm-lock.yaml`**,
  separated into Android runtime, iOS runtime and cross-platform inputs
  (the OTA workflow runs `pnpm install` but never regenerates the committed manifests, so
  a plugin bumped without a `cap sync` would ship the new JS wrapper against unchanged
  manifest bytes; the plugin set is the union of the declared dependencies and the names
  Capacitor generated and an explicit `NATIVE_DEPENDENCIES` list — three sources, because
  a package name cannot be trusted and the generated manifests only cover plugins that
  have been synced; a test asserts every generated plugin appears in the list so it cannot
  drift. Plus `patches/` with the `patchedDependencies` map, since a pnpm patch rewrites
  both halves of a package with no version change. Deliberately **not** every dependency:
  hashing the whole name set was tried and reverted after `web-vitals`, a pure-JS library,
  would have refused every staging OTA until a native release was cut).
  Every Android source set is hashed, including the credential-gated `src/meawallet`:
  the fingerprint proves source compatibility, while the compiled capability gate
  below independently requires provisioning support in the released binaries.
  An unresolvable ref is an error, never an empty read, and `--root` points the CLI at
  another checkout so its tests never mutate this one. `App Release OTA` recomputes it and compares against the
  `v<major>.<build>.0` tag the bundle's floor targets. When a same-version Android
  replacement has successfully reached Play, `scripts/check-native-ota-surface.mjs`
  may select its annotated replacement tag instead—but only after validating the tag's
  ancestry, attested fingerprint, Android-only scope, legacy-compatible input set, and
  the source-wide legacy Android permission guard named by the attestation. That guard
  forbids direct Capacitor permission calls and only permits the Camera plugin behind
  the wrapper that returns before its lazy import on Android.
  A mismatch **fails the OTA** and names the file that moved. The fingerprint remains a
  pure function of the tree; tags only attest which successfully uploaded binary owns
  that surface, and any tag can be fingerprinted retroactively (`--ref v1.2.0`).
  `MARKETING_VERSION` and
  `CURRENT_PROJECT_VERSION` are normalised out — `native-ios-postsync.js` stamps them on
  every sync, and leaving them in would refuse an OTA after every release.
  **Why it exists:** `min_update_version` only blocks *delivery*, only under the
  `metadata` channel strategy, and lives in a dashboard CI cannot read, so nothing
  previously reported that an incompatible bundle had been *built* — the mismatch first
  appeared on a user's device. The remedy for a failure is a coordinated native release
  or the narrowly gated same-version Android replacement lane—never widening or
  skipping the check.
- **Production exposure:** `release-ota.yml` promotes the verified bundle directly to the
  stable channel with rollout disabled; there is no 10% staging step today. Watch Sentry/crash
  and error rates immediately after the `main` run.
- **Rollback** is configured in `capacitor.config.ts` (`appReadyTimeout: 15000` +
  `autoDeleteFailed` + `autoDeletePrevious`): a bundle that never calls
  `notifyAppReady()` auto-reverts. **Verify once** with a deliberately-broken bundle.
- **Boundary:** OTA ships web assets only. New plugins, Gradle, permissions, versionCode
  → Play release.

### Internal testing (the `staging` channel on a real device)

Run **App Staging OTA** manually from `dev` to publish a beta bundle to `staging`;
**App Release OTA** only targets `production`. Five taps on the version line in
**Profile → About** reveal a
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

### Compiled capability gate (TASK-22282)

Production Android releases require both MeaWallet Nexus credentials and the
MeaWallet config. Production iOS archives compile with
`PEANUT_REQUIRE_PUSH_PROVISIONING`; compilation fails if the SDK cannot be imported.
The iOS sync step uses `MEAWALLET_NEXUS_USER_IOS` and
`MEAWALLET_NEXUS_PASSWORD_IOS`. The archive also requires the iOS encrypted
config in `MEAWALLET_CONFIG_BASE64_IOS`; the Xcode build phase refuses a missing
or empty config and copies it into the app bundle. Both provisioning Swift files
are app target sources and the bridge registers the plugin. Local builds can still
use the stub.

After both store builds succeed, App Release Android & iOS writes a compiled-capability
attestation into the annotated release tag. OTA checks that attestation in
addition to the source fingerprint. Older tags and manually created tags lack
this evidence and cannot serve as OTA floors. Run App Release Android & iOS to establish
a compatible floor; do not add an attestation to an unverified old tag.

This gate intentionally blocks new native releases until the MeaWallet SDK
setup is complete. It proves SDK compilation, not vendor activation or Apple
entitlements. Those remain separate launch checks.
