# UI incident preflight

## 2026-10-14: screenshot vote intent crossed a login switch

Independent review reproduced a browser `/me` response verified as Alice followed
by a vote POST authenticated as Bob after the session cookie changed. A frontend
check alone cannot fence that interval. The browser now preserves the captured
actorId with the request UUID; the server compares this optional rejection guard
with verified identity before replay. Ownership still comes only from Access.
Regression: mismatched-marker API requests leave no scope/vote/receipt, and a
browser response barrier switches identity between verification and posting.

Preflight: inspect `public/screen-library/votes.js` staged intents, account reset,
summary sequence checks and `scripts/screens/worker/votes.mjs` before mutation.
An actor-scoped receipt prevents replay duplication but alone cannot bind the
intent to the identity that originally staged it.

## 2026-10-14: vote refresh falsely settled an uncertain write

A timed-out POST can still be awaiting its D1 batch when a summary refresh reads
the old personal revision. Clearing the staged request at that revision hides
Retry and allows a later original commit to surprise the UI. Retain the original
UUID and disabled new actions until an explicit retry settles it or a newer
personal revision proves the original committed or is fenced. A definitive
400/403/404/409 rejection may clear on an authoritative refresh at the same revision.
Independent browser regression holds the original server work before D1, refreshes
the old version, then releases the commit and replays the exact request.

## 2026-10-14: full capture work before baseline and impact decisions

- Trigger: a docs/test/viewer-only change starts app capture, or a PR finishes all four after captures before finding its baseline cannot be used. Example: run 38573524506 spent 84.4 capture runner-minutes before baseline resolution failed; successful dev run 38545091100 spent 164.13 runner-minutes capturing both sides.
- Root cause: the capture workflow had no nonvisual decision, branch pairs always recaptured before, and PR compatibility was deferred to publication. The existing diagnostic `--only` output could not safely satisfy full coverage.
- Preflight: `rg -n 'scopeComplete|complete|canReuseBaseline|verifiedExternalBaselineSource|capture_before|capture_after|changedFiles|timeout|catch' scripts/screens .github/workflows/screen-library*.yml`. Inspect source and callers; a match is not itself a defect.
- Invariant: a safe skip needs a complete immutable diff; a scoped pass needs the publisher's trusted affected-flow decision and four complete locale scopes. A reused before image keeps its original provenance and must satisfy all compatibility and asset-integrity checks. A missing/incompatible baseline permits one bounded fresh capture, never a fabricated passing comparison.
- Counterexample: a shared hook, translation, asset, fixture, capture harness or rendering dependency may affect screens indirectly and requires full capture when influence cannot be proven. Old complete reports remain valid; a targeted report remains globally incomplete even when every selected state passed.
- Regression: frozen `capture-cost-acceptance.test.mjs` covers the pure contracts and 64 seeded cyclic graph/permutation cases (seed `0x51c0ffee`). Integration, workflow, stale/source provenance, parser, fault and disposable mutation evidence is recorded in the feature plan after execution.

## Balance validation after a withdrawal starts (2026-10-13)

- Trigger: live balance decreases while the crypto withdrawal review remains mounted during execution or payment recording. The obsolete affordability warning flashes before success.
- Evidence: PostHog confirmed -> settled -> completed sequence on Android release b105626; user explicitly requested removal of the false warning.
- Root cause: ConfirmWithdrawView rendered insufficientBalance without checking processing or executed-spend state.
- Search: `rg -n 'insufficientBalance|alreadySpent|isProcessing' src/features/withdraw/views/ConfirmWithdrawView.tsx`; inspect all component call sites when changing these states.
- Invariant: suppress balance warnings during processing and after this charge has spent. Preserve the pre-sign balance check and real operation errors. Disable Retry while processing, including record-only recovery.
- Counterexample: an idle charge that has not spent and cannot afford the amount must still show the warning and block confirmation.
- Regression: ConfirmWithdrawView.processing-balance.test.tsx exhausts the eight processing/spent/shortage states and exercises refresh, unsuccessful execution, recording recovery, duplicate clicks and Send framing.

# Push identity incidents and regression checks

## 2026-10-13: explicit logout retained account push identity

Trigger: clear authentication and reload while the device remains linked in OneSignal. A fresh JavaScript tracker cannot prove the SDK is anonymous. SDK login can also settle after logout, and failed unlink must not clear the retry obligation.

User decision: logged-out devices may receive only notifications unrelated to an account. Keep the anonymous subscription enabled. Source: this explicit-logout investigation and fix.

Preflight: `rg -n 'login|logout|catch|inFlight|setTimeout|storage|isLoading|isFetchingUser' src/services/onesignal src/hooks/useNotifications.ts src/context/authContext.tsx`.

Inspect enclosing behavior; search hits alone are not defects. Counterexamples: an app lock or unresolved offline query is not logout; a fresh authenticated login may intentionally relink the device. Browser storage events can be stale after a newer trusted login.

Regression evidence:
- `identity-sync.test.ts`: persisted identity, duplicate calls, init/login/logout races, retries, all 81 length-four null/A/B sequences.
- `identity.test.ts` and `authContext-push-identity.test.tsx`: explicit unlink ordering, timeout, trusted login boundary, persistence/cross-tab propagation, paused query, stale hydration/setup.
- `identity-recovery.test.ts`: retry after a hung SDK operation; late completion compensation without timer-driven retry loops.
- `identity-late-order.test.ts`: simultaneous raw SDK completions cannot erase invalidation.
- `identity-storage-order.test.ts`: queued old logout event cannot override a newer trusted login.
- `identity-version.test.ts` and provider tests: distinct persisted receipts fence pending authenticated responses across tabs, before event delivery.

Disposable mutation: initializing the applied identity to null leaves the simulated persisted account linked; the initial signed-out acceptance test fails. Product source was not mutated.

Provider limit: native bridge promises resolve after invoking OneSignal, without a provider completion callback. Local tests prove dispatch/order and simulated convergence. They do not prove APNs/FCM delivery, recall already queued messages, or recover an SDK-internal init latch that never settles without a reload.

## 2026-10-14: cross-tab login retained the observer's logout latch

Verified PR finding: after one tab accepts a logout event, another tab's fresh login removes the shared active marker, but the observer remains latched anonymous. If the observer's prior SDK unlink failed, its next positive sync can also detach the new shared identity. An independent two-context harness reproduced both outcomes at 85215d1bc.

Preflight: `rg -n 'explicitlyLoggedOut|storage|verificationRevision|reconcileNotificationIdentity|onNotificationIdentityLoginAvailable|cancelRefetch' src/services/onesignal/identity.ts src/context/authContext.tsx`.

Invariant: marker removal only requests fresh profile verification; it is not evidence of an authenticated account. Release only the observer's in-memory latch after fresh proof and unchanged revision, durable logout receipt, and shared active state. Never erase shared state during observer reconciliation. Reject failed/null/invalid/expired results and pending work from a locked, logging-out, or unmounted provider; retry on a later lifecycle signal. Preserve ordinary guarded SDK-hook calls.

Regression evidence: `identity-cross-tab-login.test.ts` covers receipt/revision races, current-state event checks, verification timeout/late completion, storage failure and persisted startup. `authContext-cross-tab-login.test.tsx` covers fresh refetch, error/null results, recovery signals, blocked sessions and pending lock invalidation. Generic subscription and permission remain enabled.

Additional reachable race: the real provider/hook/QueryClient harness observed SDK B -> A -> B when login(B) emitted a subscription callback before React rendered profile B. Hook callbacks now use `syncNotificationIdentityFromHook`, retaining the last auth-selected identity. Authorized auth sync remains compatible. CT14/15 and `authContext-cross-tab-hook-race.test.tsx` forbid any transient former-account login; same-account metadata updates also cannot restart pending verification.

A queued online task reproduced the same sequence without an SDK event: React had not rendered the updated cache yet. Provider lifecycle callbacks read current `QueryClient.getQueryData([USER])`, and skip unknown data. `authContext-cross-tab-lifecycle-race.test.tsx` freezes the actual TanStack event ordering; do not replace its real client with a synchronous cache stub.

## 2026-10-14: visual history admitted or omitted the wrong observations

- Trigger: a library and comparison publish the same tiny visual change; conflicting report metadata claims another viewport/locale; a failed initial PR baseline is followed by a refreshed base; or malformed manifests occur among valid captures.
- Root cause: publication ordering could bypass a comparison noise hint, entry metadata masked manifest conflicts, later PR bases were treated as history, and malformed observations were silently filtered or crashed sorting. Independent VM repros confirmed these cases before correction.
- Preflight: `rg -n 'screenHistoryScope|snapshots|trustedNoise|initialRecord|historyEntryOrder|failures|historyEligible' public/screen-library/viewer.js`. Inspect the observed ordering, every scope field, gap output and entry points; a match alone is not a defect.
- Invariant: pair duplicate publications before emission, trust noise only against the immediately observed baseline, reject conflicting context with a visible gap, preserve A-B-A, and use only the initial PR baseline. Components share route history eligibility. Every explicit failed-read retry batch must eventually reach later failures while retaining successes.
- Counterexample: matching asset identities in consecutive captures legitimately collapse; A-B-A remains three versions. A missing screen or failed read is a gap and cannot establish removal. Invalid public-helper paths must never reach the reader.
- Regression: frozen `screen-history-acceptance.test.mjs` covers the accepted contract and seeded visual sequences. `screen-history-regressions.test.mjs` covers paired-noise permutations, scope conflicts, malformed observations, PR bases, components, persistent failure rotation, unavailable contexts, invalid path diagnostics and Escape with a focused slider. Browser geometry assertions separately check that phone frames fit each timeline/detail column at 320, 390, 768 and 1024 pixels.

## 2026-10-19: Android passkey timeout ownership and cleanup guidance

- Trigger: options or verification outlives the UI deadline, or a native provider never confirms cancellation. A global cancel callback can target a newer signing request; a delayed options response can open a prompt for an expired login.
- Invariant: bind cancellation to the issuing request ID, retain expired SDK scope until its continuation terminates, and reject overlapping native requests while cleanup is unknown. Timeout does not prove native cancellation.
- Search: `rg -n 'cancelActive|cancelRequest|pending|guardPasskeyCeremony|navigator.credentials' src/utils src/hooks/useZeroDev.ts src/features/setup`. Inspect the full async path and signup catch branches. A generic message containing pending must not swallow a named cleanup guard as success.
- Regression: `android-passkey-control.test.ts`, `android-passkey-scope.test.ts`, independent controller acceptance tests, signup/login hook regressions, and the native coordinator sequence tests. The disposable native cancellation-marking mutation fails the acceptance assertions.
- Counterexample: a terminal native response can safely release its own request slot; a stale callback cannot release a newer one. An enabled Play Services package is not proof of an available credential provider.
- Evidence boundary: TASK-23424 reports Chrome success on China-market devices; code checks and native library compilation do not establish a regional root cause or device recovery.

## Android registration client-data layout (2026-10-30)

- Incident: TASK-23931 (https://app.notion.com/p/400838117579816ba174e18230323fbf), related TASK-22823. A correctly signed sorted Android assertion can fail AA24 because the deployed validator fixes the challenge-property location at byte 23. The earlier substitution hypothesis is unproven for these signups; pinning and error recovery already landed in #3550 and #3782.
- Check: `rg -n 'createCredential|clientDataJSON|TextDecoder|toWebAuthnKey' src/utils src/hooks/useZeroDev.ts`. Inspect the shim and SDK continuation: reject before register/verify; never reorder signed JSON. Decoder normalization can conceal byte offsets, so include UTF-8 BOM and whitespace cases.
- Counterexample: a standard compact registration with an opaque device-bound attestation is allowed. Backup eligibility alone is not incompatibility, and iOS/web/get calls must not inherit an Android create-only guard.
- Regression: android-passkey-registration-compatibility.test.ts covers deterministic JSON-order permutations, malformed/shifted bytes, unchanged credentials, sanitized errors and forbidden server continuation. useSignupPasskey.test.tsx covers translated inline guidance and no completion after rejection. Finder and independent verifier reproduced the BOM counterexample; preserving BOM during decoding closes it. Disposable guard-removal mutation fails the sorted-layout assertion; original passes.
