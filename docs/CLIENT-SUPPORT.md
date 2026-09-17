# Client support policy (mandatory update)

The UI enforces the minimum supported client generation. The API does not: no
version headers, no version checks, no new routes. The process and the source
of truth live in mono, `engineering/compatibility/README.md`.

## Pieces in this repository

| piece                                           | role                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/client-support.consts.ts`        | `CLIENT_GENERATION`, the integer this bundle carries. Independent of the shell version and of `APP_RELEASE`.                                                                     |
| `public/client-support.json`                    | the public policy, `{ schemaVersion: 1, minimumGeneration: { web, ios, android } }`. Served with `no-store` and open CORS (`next.config.js`); the service worker never caches it. |
| `scripts/client-support-policy.lock.json`       | the mono commit and the canonical SHA-256 of its registry that the snapshot derives from. Never the registry itself.                                                             |
| `scripts/client-support-policy.mjs`             | `sync`, `proof` and `check`. Dependency-free.                                                                                                                                    |
| `src/utils/client-support.ts`                   | strict parser, platform grouping, verdict, storage, live read.                                                                                                                   |
| `src/hooks/useClientSupport.ts`                 | startup and resume checks.                                                                                                                                                       |
| `src/components/Global/ClientSupportGate`       | the gate in `ClientProviders`, the forced-update screen and the retry screen.                                                                                                    |

Platform groups follow mono: `web`, `ios-pwa` and `android-pwa` read the `web`
floor; `ios-native` reads `ios`; `android-native` reads `android`.

## Runtime behavior

- Startup: the gate reads the live policy (native from `https://peanut.me`,
  web same-origin) before the wallet providers mount. Only a valid live
  `supported` verdict mounts them. A remembered policy is used for one thing:
  a block it recorded holds while the live read fails. A remembered
  "supported" never admits the app. With no live policy and no remembered
  block the user sees a retry screen.
- Availability trade: a policy outage blocks the wallet until a retry succeeds.
  The zero policy only disables the update demand; the read still happens.
- Resume (`visibilitychange`, native `appStateChange`): the mounted tree keeps
  its DOM position and state, covered and inert while the read runs. A
  supported result lifts the cover without remounting. A failed read keeps a
  retry cover. An unsupported result unmounts the wallet providers and shows
  the forced-update screen, which nothing dismisses.
- Forced update: native restarts onto a staged Capgo bundle through
  `useOtaUpdate().applyNow`, asks the updater for one through `checkNow`, or
  opens the store when no over-the-air bundle can satisfy the floor. Web and
  PWA reload on a tap. The screen never unlocks on an OTA outcome: only the
  policy check after the restart can.
- Marketing routes are not gated.

## Operator: sync the snapshot from mono

Run from this repository with the mono checkout at the commit whose registry
is the new source:

```sh
node scripts/client-support-policy.mjs sync \
  --registry ../mono/engineering/compatibility/registry.json \
  --mono-sha "$(git -C ../mono rev-parse HEAD)"
node scripts/client-support-policy.mjs check --registry ../mono/engineering/compatibility/registry.json
```

Commit `public/client-support.json` and the lock together.

**The pinned commit must be on mono `main` before UI CI can pass.** CI
compares the pin with mono `main` and accepts only an ancestor (compare status
`ahead` or `identical`, merge base at the pin). Merge order:

1. Merge the mono PR that carries the registry change (for the foundation,
   mono PR 194 carrying `99c3e3fe…`).
2. If mono squash-merged it, the pinned commit is not on `main`. Re-run `sync`
   against the merged commit and update the lock and snapshot here.
3. Re-run the UI workflow (`ci-success` stays red until then).

CI (`client-support-source` and `client-support-policy` in
`.github/workflows/tests.yml`) verifies the pin's ancestry, fetches the pinned
registry with `MONO_READ_TOKEN`, derives a public proof (policy, pin, digest)
in the job that holds the credential, and checks the snapshot and lock against
that proof. It fails closed: no token, an unmerged or unknown pin, no fetch,
or a mismatch blocks `ci-success`. The registry never becomes an artifact and
is never printed; only the compare status reaches the log.

## Rollout order for a non-zero floor

1. Publish and verify the replacement client (web deploy, OTA, store) and
   record its release and rollback bundles in the mono registry.
2. Raise the floor in mono, then sync and merge the snapshot here. The web
   deploy is what publishes the new policy to every platform.
3. Verify startup, resume, OTA restart, store fallback and web reload on real
   devices. Unit tests cover the logic, not the binaries.
4. Follow the retirement checks in mono before removing any compatibility code.

Analytics: `instrumentation-client.ts` registers `platform` with `app_release`
before the initial pageview, which is what the mono readiness report groups by.

## Fixtures

- `/home?__fixture=update-required` — forced-update screen (web variant).
- `/home?__fixture=update-check-failed` — policy unreadable, nothing
  remembered: retry screen.

The native restart and store variants need a device or simulator; no web
fixture can show them.
