# Native (Android) Release & Play Store Review

How to build, sign, ship, and get the Android app through Play review. Native CI
is intentionally not wired yet — this is the durable manual runbook.

> Architecture: Capacitor 8 wrapping a static export of the Next.js app. One
> codebase, web + Android. See `scripts/native-build.js`, `capacitor.config.ts`.

---

## 1. Reviewer access (the May-18 rejection fix)

The app is invite-only and passkey-only, which is why the reviewer's access
"didn't work". There is now a **reviewer/demo mode** entered with a single code.

### How it works
- Reviewer enters invite code **`demo`** during signup.
- Backend (`peanut-api-ts`) maps `demo` → the `reviewer` inviter so the account
  gets app access (`PROD_SPECIAL_INVITE_CODES_MAP` in `src/utils/invite.ts`).
- The native client recognizes the `demo` code and turns on reviewer mode
  (`peanut-ui/src/utils/reviewer.ts`), which:
  - overlays **pre-filled balance + transaction history** (no empty states),
  - **skips KYC** (no Sumsub wall),
  - **simulates** send/pay/withdraw (no real funds, no on-chain tx — safe on
    mainnet/production).
- The reviewer still creates a **real passkey** on their device — this exercises
  the core sign-in mechanic, which is what review needs to see.

### One-time backend setup (per environment)
Seed the `reviewer` inviter on staging **and** production:
```bash
# in peanut-api-ts, with DATABASE_URL pointing at the target env
npx tsx scripts/seed-reviewer-user.ts
```
(On localhost the inviter self-heals via `ensureDevInviter()`, so local dev needs
no seed.)

### Play Console "App access" declaration
Under **App content → App access → All or some functionality is restricted**, add:
- **Instructions:** "On the sign-up screen, enter the invite code `demo` and tap
  Continue. Create a passkey when prompted (use the device screen lock / Google
  account). You'll land on a populated demo wallet. No username/password needed."
- No login credentials are required (passwordless) — the invite code is the access
  mechanism. Provide the `demo` code in the credentials/notes field.

---

## 2. Passkey reliability fixes shipped

- **Silent "Set it up" failure** (the other rejection reason): the button now
  re-checks native passkey support on tap and shows an actionable message
  ("sign in to a Google account / update Google Play Services") instead of doing
  nothing. See `SetupPasskey.tsx` + `passkeyPreflight.ts`.
- **Multi-account signing bug:** native signing is now pinned to the kernel's own
  credential (`native-webauthn.ts` + `kernelClient.context.tsx`). **Must be
  smoke-tested on a 2-account Android device before relying on it** (see §6).

---

## 3. Build the release

```bash
pnpm install                       # --recurse-submodules clone required (src/content)
node scripts/native-build.js       # static export → ./out  (runs the anti-rot guard first)
npx cap sync android               # copy web assets + plugins into android/
```

`native-build.js` now **fails loudly** if a new server-only route (route handler
or `force-dynamic` page) isn't covered by `ITEMS_TO_DISABLE`. If it errors with a
list of paths, add them to that list (web-only) or give the page a
`generateStaticParams`. This is the fix for the "build rot" that silently broke
the native build after web changes.

### Versioning
`android/app/build.gradle` resolves the version automatically — no manual edit:
- `versionName` ← `ANDROID_VERSION_NAME` env, else `package.json` `version`.
- `versionCode` ← `ANDROID_VERSION_CODE` env, else the **git commit count**
  (`git rev-list --count HEAD`) — monotonic and bookkeeping-free, floored at 2
  (the rejected first upload was code 1; Play requires each upload to be higher).

This holds even for a raw `./gradlew :app:bundleRelease`, so a stray manual build
can't accidentally ship a stale/duplicate code.

### Produce a signed AAB (blessed path)
```bash
pnpm native:release
# = derive version → native:build → cap sync android → ./gradlew :app:bundleRelease
# output: android/app/build/outputs/bundle/release/app-release.aab
```
`scripts/native-release.sh` prints the resolved `versionName`/`versionCode` up
front and warns if `keystore.properties` is missing. Overrides when needed:
```bash
ANDROID_VERSION_NAME=1.0.0 pnpm native:release      # set the user-facing name
ANDROID_VERSION_CODE=9000  pnpm native:release      # leapfrog a prior upload
```

---

## 4. Signing & keystore

- **Play App Signing is enabled**, so the app signing key is held by Google — a
  lost upload key is recoverable by requesting an upload-key reset. Still, treat
  the upload key as a secret.
- Signing config in `android/app/build.gradle` reads `keystore.properties`
  (gitignored) at repo root:
  ```properties
  storeFile=../peanut-release.keystore
  storePassword=...
  keyAlias=peanut
  keyPassword=...
  ```
- **Action item — back up the upload keystore.** It currently lives on one
  machine. Store `peanut-release.keystore` + its passwords in the team secret
  manager (1Password / Vault) so a machine loss doesn't block releases.
- Digital Asset Links (`public/.well-known/assetlinks.json`) already lists three
  SHA-256 fingerprints (dev/staging/prod upload + Play App Signing). Confirm the
  **Play App Signing** cert fingerprint (Play Console → App integrity) is among
  them, or passkeys (rpId `peanut.me`) break in the store build.

---

## 5. OTA updates (Capgo)

- `.github/workflows/capgo-deploy.yml` builds the static export and uploads to
  Capgo on push: `main` → `production`, `dev` → `staging`; manual dispatch picks
  the channel.
- **Action item — configure the `production` channel** in the Capgo dashboard
  (only dev/staging were wired). Verify `autoUpdate` + rollback against a
  production bundle before relying on OTA for the store build.
- OTA ships **web assets only**. Native changes (new plugins like haptics/keyboard,
  Gradle/version bumps) require a new AAB through Play — they can't be OTA'd.

---

## 6. Pre-submission verification

1. **Local stack:** run `peanut-api-ts` (:5000) + `peanut-ui` (:3000), seed the
   `reviewer` user, confirm `demo` validates.
2. **Build:** `node scripts/native-build.js` succeeds; `npx cap sync android`;
   `bundleRelease` produces a signed AAB with versionCode ≥ 2.
3. **Reviewer-mode E2E on a real device:** install → invite `demo` → register
   passkey → Home & History show demo data → KYC is skipped → a send reaches a
   simulated success with no on-chain tx.
4. **Passkey silent-failure:** on a device with no Google account / outdated Play
   Services, "Set it up" shows an actionable error (never a no-op).
5. **Multi-account smoke test:** two Peanut accounts on one Android device → sign
   a transaction from each → both produce valid on-chain signatures.
6. `pnpm test:unit:ci` green; `pnpm typecheck` clean.

---

## 7. Play submission

- Upload the AAB to a **closed/internal testing** track first; dogfood the
  reviewer flow end-to-end.
- Re-check **Data safety**, **permissions** (camera for QR/KYC), **content
  rating**, and the **App access** instructions above.
- Promote to **production** review only after the internal track passes.
