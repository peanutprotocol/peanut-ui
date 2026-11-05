# UI incident preflight

## 2026-11-02: browser contract build exhausted Node's default heap

- Trigger: PR #3900 Tests run 41464516586, press-contract job 125341899149,
  aborted during the production build at roughly 2 GiB with `Reached heap limit`.
  Neither browser spec ran; the required aggregate check correctly failed.
- Root cause: browser contract builds inherited Node 20's implicit heap budget.
  Set an explicit bounded 4096 MiB old-space budget on those build steps only.
  This does not cap total process RSS or justify increasing timeouts/retries.
- Search: `rg -n 'pnpm build|NODE_OPTIONS|continue-on-error|timeout-minutes' .github/workflows/tests.yml`.
  Inspect effective build environments and preserve blocking browser assertions.
- Counterexample: the native build and Screen Library use separate build paths;
  a missing heap override is not proof that every Node task needs more memory.
- Regression: `browser-build-memory.test.mjs` checks parsed workflow scope,
  existing deadlines and browser gates, and the effective heap in a child Node
  process. Actual production builds remain the evidence of memory sufficiency.

## 2026-11-02: before app received the head synthetic API

- Trigger: UI PR #3620 at 3cd397138 changed the synthetic contract; its head harness fed incompatible data to the base app (owner-reported 258/295 before states failed).
- Invariant: compare shared transitive fixture roots and adapter answer code across immutable revisions. Synthetic changes use each app's own harness with an explicit before receipt. Renderer mismatches remain errors; source manifests alone cannot prove a reused capture's producing harness.
- Search: `rg -n 'sameEnvironment|compare\(|canReuseBaseline|verifiedExternalBaselineSource|beforeHarness' scripts/screens`. Inspect report creation, publication, offline bundling and every baseline path.
- Counterexample: a capture-code-only or catalogue-only change retains the head harness on both sides to avoid artificial differences.
- Regression: `before-harness-acceptance.test.mjs` freezes trigger, receipt, renderer and reuse contracts; `capture-cost-integration.test.mjs` checks provider provenance, capability fallback and receipt preservation through offline reports.

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


## KYC feature reports and recovery (2026-11-02)

- Evidence: release review-out/r3 F12/F13/F14/F15/F54/F57/F59/F60/F62/F65/F66/F67 and explicit app-fix request.
- Triggers: a refusal is presented as residence regardless of reason, a failed second request reports success, or a pending/replacement session never observes its eventual decision. Shared provider actions can also misroute QR verification.
- Search: `rg -n 'refusalOf|entryChip|completed|backendOrFallback|pendingApplication|approvedAtOpen|restart-identity' src/components/AddMoney/components/MantecaAddMoneyFlow.tsx src/components/Profile/views/MoneySettings.view.tsx src/hooks/useSumsubKycFlow.ts src/app/actions/sumsub.ts src/features/card src/features/paperwork-verification src/features/payments/flows/qr-pay/qrKycGate.utils.ts`. Inspect each caller and reason/action pair; a match is only a lead.
- Invariants: render a refusal's own localized explanation and remedy; unknown reads remain unknown; only route absence selects legacy funding; pending reconciliation repeats reads without repeating writes; submitted replacement review waits for APPROVED. Preserve backend recovery codes even without userMessage.
- Counterexamples: geo-blocked legitimately gets residence copy; quiet wait is intentional; cold REVERIFYING preserves held access; a global identity-missing cause applies to QR while Rain-only ID requests do not.
- Privacy searches: `rg -n 'us_citizen_not_supported|KYC_PV_LOCAL_REFUSED|KYC_PV_CONTINUE_WITHOUT_LOCAL|supportLinkedAccounts' src/features/paperwork-verification src/utils/support-context.ts src/interfaces/interfaces.ts`. Field validation may name a refusal to the user, but identified analytics must normalize answer-revealing codes and omit answer-specific events. Public support links contain relation only.
- Regression: extended existing MantecaAddMoney, MoneySettings, useSumsubKycFlow, paperwork flow/analytics, identity restart, QR gate and support-context tests; new useCardFundingAccess and pendingApplication tests exercise 404 versus failures and timer-only reconciliation. Catalog tests preserve es-AR inheritance, regional verb forms and localized product articles.


## KYC account continuity and typed-answer echoes (release review, 2026-11-02)

Verified incidents: passive 401 left private queries cached; profile/paperwork keys had no account identity; a permission wait and a queued answer batch could continue under the shared cookie's next user. A typed city also escaped the input as pill and portal text.

Preflight: inspect `clearAccountQueries`, `useSessionFence`, scoped profile/paperwork keys, each `saveSteps` step and retry, terminal queue-generation invalidation, and `expectedUserId` at the transport boundary. An epoch alone cannot detect another tab replacing the cookie. Same-user token refresh remains valid. Check late initial reads after unmount too: an obsolete hand-back must not navigate the next account Home.

Evidence: deferred permission/answer/read tests, real A→B cookie changes, same-user refresh, missing/malformed token and unmount negatives. The disposable saveSteps variant with account checks removed sent its second step as B and failed the account regression; production source was never mutated. The real replay and autocapture redactors must remove typed city text, attributes and portal suggestions. Fixed-option labels retain the existing policy.

Server ownership checks remain the final race boundary; mocked client tests do not establish deployed API enforcement. No hooks were installed, trusted, or activated by this change; hosted CI and branch protections remain the merge boundary.

## TASK-24355 — grouped request suggestions (2026-11-02)

- Trigger: a request suggestion of 4000 is formatted as `4,000`, then `Number('4,000')` becomes NaN. The real slider renders NaN%; raw callback amounts can still be correct because callbacks separately strip commas. This alone does not prove a bad transaction.
- Root cause: AmountInput suggestion used display-mode `formatTokenAmount` before numeric arithmetic. The previous TokenAmountInput slider explicitly stripped commas. Original change: peanut-ui commit 3a2ad8d1dd, Juan José Ramírez, 2025-12-26 07:23:42 UTC; later blame movement did not introduce this expression.
- Search: `rg -n 'Number\(formatted|parseFloat\(.*Amount|formatTokenAmount' src/components/Global/AmountInput src/features/payments/flows/contribute-pot`. Inspect units and formatting mode; search hits alone are not bugs.
- Safe counterexample: parsing raw `4000` is valid; the slider-change branch already uses input formatting mode.
- Regression: finite-amount.test.tsx uses the real slider at 999, 1000, 4000, 10000, invalid initial/suggested/typed values and overflow. Payment flow tests separately reject invalid data before charge creation, even when called outside the UI button.

### PR3902 follow-up — repeating-rate roundtrips

- Trigger: at ARS1200/USD1, toggling untouched ARS0.05 or ARS4000 to USD and back loses a cent. Storing even36 decimal conversion digits cannot exactly represent a repeating rate; a delayed rate update can also change the original payer amount.
- Invariant: anchor canonical input in the denomination last edited. Currency toggles change presentation; only a genuine edit changes monetary intent. Convert from that original amount once, at the destination precision.
- Search: `rg -n 'setExactAmount|convertDecimalAmount|setDisplaySymbol' src/components/Global/AmountInput/index.tsx`; inspect every edit, suggestion, balance-fill and toggle writer. A newly typed USD amount is a safe counterexample: it intentionally replaces prior ARS intent.
- Regression: independent `exact-roundtrip.test.tsx` covers2/4/10 toggles, sub-cent and4000 inputs, genuine edits and delayed rate changes. Restoring the published pre-repair component in a disposable copy fails8 of10 tests; the fixed component passes all10.
- Fixture compatibility: formatter mocks must preserve newly used real exports. The crypto-deposit mock omitted `formatFiniteDisplay`; retain the actual currency module before explicit test overrides. The loaded deposit/QR, warning and help-button tests exercise this path.

## Screen Library delayed reviews and hidden migration failures (2026-11-03)

- Incidents: PR runs 41679094911 and 41670257738 reached baseline resolution after merge. Dev runs 41495459992, 41640020827, 41663517701, 41669769475, 41670158647 and 41672182616 failed comments migration with only a Wrangler banner.
- Search: `rg -n 'reviewProvenance|reviewPullRequest|mode|needs:' scripts/screens/resolve-baseline.mjs scripts/screens/review-provenance.mjs .github/workflows/screen-library-publish.yml`; inspect exact head/repository/branch/event-number binding and every downstream output consumer. Closed state alone on an unrelated PR is not skip evidence. Open unresolved provenance remains a failure.
- Diagnostic check: inspect `executeSql`, `initMigrationsTable`, `listAppliedMigrations`, `main` and `appendToDebugLogFile` in locked Wrangler 4.40.2. A thrown JSON ledger query leaves console level at error while some API error handlers use log. Preserve non-debug private-log messages through sanitization; never dump debug HTTP records or raw credentials. The original remote error remains unknown.
- Regression: publish-failures.test.mjs, deploy-operation.test.mjs and workflow-policy.test.mjs cover exact closed/current captures, invalid/open failures, bounded redacted stdout/stderr/private logs, status, budgets and skip propagation. A harmless counterexample is a dev push with current captures: publisher provenance still verifies it. Additive migration replay is separately checked in local SQLite; it cannot establish remote D1 state.

## Attention catalogue and partial facts (2026-11-03)

- Trigger: a truncated live catalogue silently mixes server and bundled policy; unavailable spend history becomes “no previous spend”; server-only onboarding unknown hides a locally known checklist. Review of UI PR3667/API PR1838 reproduced all three.
- Search: `rg -n 'asCatalogue|applyServerFacts|applyServerRanking|spendHistoryAvailable|selectHomeTasks|next-payment' src/features/attention src/utils/activation-step.utils.ts`. Inspect complete-catalogue validation and each unavailable fact through its consuming verdict. An empty query result is different from a failed query.
- Invariants: supported live catalogues replace policy atomically; generated snapshots come only from the backend exporter; unavailable latest spend holds the reminder; client-only onboarding facts can complete the same canonical resolver without fabricating a server answer.
- Counterexample: a successful full-history read with no spend may legitimately recommend payment; a known local card path can resolve server-only unknowns. Neither permits treating failed history as empty.
- Regression: catalogue.acceptance.test.ts reproduces malformed/truncated policy, local checklist fallback, independent QR-success/spend-failure and bounded private-data-free explanations. Independent ledger/engine tests cover long versions and device restrictions. Provider/push tests cover account changes and failed preference saves; announcement tests preserve overlay yield/resume without another budget debit.
- Evidence boundary: local mocked checks cannot prove live push delivery, passkey approval, provider behavior or deployed rules. Required hosted CI remains the merge boundary.

# Post-KYC setup completion (L8, 2026-11-05)

- Trigger: an approved identity has an ARS questions action or an explicit provider-review wait. Treating every unavailable account as active provisioning produced a 30-second timeout for a state that needs a person or provider.
- Search: `rg -n 'allSettled|requirements_in_review|setModalPhase|onKycSuccess' src/hooks/useMultiPhaseKycFlow.ts`. Inspect the fresh, reactive, no-SDK and legacy-session branches and the money-form callers.
- Counterexample: a plain `setting_up` account without a wait action is still provisioning; a missing feature report is unknown. Neither can complete as a usable rail. A review in another country cannot authorize the requested account.
- Regression evidence: `useMultiPhaseKycFlow.regionReadiness.test.ts` covers action/review completion, failed refresh, delayed responses, country isolation and idempotent callbacks. Explicit provider waits finish the setup UI without invoking money callbacks. Source inspection and failing regressions also found unrelated supplement review and late terms confirmation crossing the completion boundary.
