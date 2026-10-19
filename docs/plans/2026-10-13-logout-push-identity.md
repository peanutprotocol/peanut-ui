# Explicit logout and push identity

User decision (2026-10-13): after logout only notifications unrelated to an account should work. Keep anonymous push subscriptions enabled; detach the current device from the former account. No merge/deployment authorized. Plan mode unavailable; this is the persisted equivalent.

## Acceptance
- P1: Explicit logout unlinks OneSignal before navigation, independently of notification UI mounting.
- P2: Confirmed signed-out startup reconciles persisted SDK identity to anonymous; fresh JS bookkeeping is not SDK identity.
- P3: Concurrent identity changes converge to the latest identity. Logout during pending login ends anonymous; duplicates do not create duplicate logins.
- P4: Failed init/unlink remains observable and retryable; logout has a bounded push wait.
- P5: Keep generic push subscription and permission enabled; B never inherits A after reconciliation.
- P6: Hydration, app lock, and transient API failure are not logout.

## What can go wrong
| Category | Trigger; invariant; verification | Decision |
| --- | --- | --- |
| Invalid input | Missing/empty ID means anonymous, never an empty login. IDs originate in authenticated profile; no new Unicode/oversize parser. | P2; unit tests |
| Concurrency | Init/login/logout/account switch overlap; latest identity wins. | P3; deferred promises |
| Idempotency | Duplicate calls join work; successful state deduplicates. | P3; effects and final state |
| Timeouts | SDK may hang; bounded logout wait preserves auth escape and reports uncertainty. | P4; fake clock |
| Retries | SDK failure retains obligation; retry next lifecycle signal, finite work per attempt. | P4; fault tests |
| Partial failure | Auth cleared, unlink uncertain; signed-out restart reconciles again. | P1/P2/P4 |
| Auth | Detach current device only; preserve other devices, lock/hydration distinction. | P5/P6; user decision |
| Data/resource limits | One latest desired identity, no batch/history; operation-sequence tests, no capacity-sensitive path. | P3 |
| Migration | Existing SDK link survives JS reload; reconcile confirmed absent session. No schema/native API migration. | P2 |

Provider limit: local SDK success is not provider acknowledgment. Messages already handed to APNs/FCM cannot be recalled by JavaScript logout. Physical-device/offline verification remains separate.

## Milestones
1. Fresh spec-only test author using a different model; filesystem separation is instructional only.
2. Implement explicit logout and serialized reconciliation; preserve auth behavior.
3. Run focused notification/auth tests, lint/typecheck, configured workspace checks; challenge a guard in a disposable copy; inspect relevant defect preflight.
4. Publish PR assigned to innolope-dev. No merge/deployment.

Rollback: revert PR, no data migration. Old bundles keep old behavior until updated.

## Verification and observed failures

Fresh spec-only author selected as `gpt-6-astra`, no inherited conversation or production-source access by instruction; shared filesystem isolation was not enforced. Separate finder and verifier roles independently reproduced offline paused-query misclassification, blocked retry after timeout, same-turn late-completion invalidation, and queued stale storage events. Tests were frozen before each repair. The legacy hook fixture now settles A before B, preserving its duplicate/retry assertions while allowing serialized SDK writes.

Implementation: shared identity worker, explicit auth logout with 3-second total push wait, 3-second operation deadlines, retry only on a new lifecycle call or observed late settlement, durable non-secret logout boundary, current-storage validation, authenticated resume generation guard, and confirmed-profile startup reconciliation.

No business decision was inferred from silence. Timeout durations are operational budgets; provider/network uncertainty remains observable. General push permission and opt-in are retained. A never-settling SDK-internal initialization latch can still require document reload; no provider cancellation/fencing API exists in this adapter contract.

Local setup: isolated worktree at fresh origin/main; reused installed dependency packages through local links, added the existing exact react-day-picker 10.0.1 package, generated standard Next type references, and materialized testimonials from the pinned content submodule commit. No other checkout was modified.

Initial local results: 19 relevant Jest suites / 104 tests passed; all 81 four-operation sequences covered. Full repository ESLint passed with 64 warnings, and changed-file ESLint passed with the existing navigation warning. Strict TypeScript for the standalone identity worker passed. Disposable unknown-to-null mutation failed its intended acceptance assertion. Aggregate configured KYC tests/lint passed separately. Initial full TypeScript attempts did not complete within their 300-second budget; that gap was resolved in the follow-up below. No native build, provider send, merge, deployment, or physical-device acceptance was performed.

Cross-tab follow-up: every explicit logout writes a distinct non-secret receipt. Login hydration and account setup compare the receipt before/after their awaits, so a response started before another tab logs out cannot release the boundary, even before the storage event is delivered. Frozen version tests include repeated logout at one fixed timestamp.

Verified spec correction: active logged-out status and last logout version must be separate. The verifier reproduced null -> logout -> trusted login -> null before queued events arrived; this let old authentication work pass an equality guard. The spec-only author independently corrected its invented post-resume-null version expectation, retaining all active-marker/fresh-login assertions. The last receipt now persists after login, preventing that ABA race without retaining account data or growing history.

Commit gate incident: implicit tool workdir caused the installed hook to fingerprint the aggregate workspace and exhaust its budget. Explicit `git -C` correctly selected this package and exposed absent package gates. Added supported package-local tests/lint configuration with the same 300-second budget; no hook scripts, trust records, or aggregate gate configuration changed. Local full TypeScript remains incomplete and must be resolved by CI before merge.

Direct package gate execution passed with `ok: true`: tests and lint both returned 0 without timeout or source/index mutation. Installed hook activation is evidenced separately by its observed compound-commit denial, aggregate fingerprint-budget denial, and package-unconfigured denial; no trust configuration was changed.

## Verification follow-up completed 2026-10-13

Full repository TypeScript passed with Node 20.19.0, matching CI major version, after standard Next type generation and restoring the pinned content footer manifest. The completed initial compiler run exposed global-scope collisions in five new tests. The independent test author added only `export {}` module boundaries, verifying hashes of all existing mocks/assertions remained unchanged; all five affected suites passed (18 tests). The corrected full check returned 0 in 99.09 seconds with no weakened compiler flags or source exclusions.

The aggregate Stop event also passed (exit 0, empty JSON result) in 31.32 seconds with its original configuration/checks/300-second budget unchanged. Its prior timeout came from recursively fingerprinting independent checkouts. Exact aggregate-only Git ignore entries now separate 99 physical independent roots; five independent scope tests and a verifier confirmed all 24 KYC inputs still hashed and ordinary source changes remain detected. No installed hook/trust scripts were edited. See aggregate `docs/plans/2026-10-13-validation-boundary.md` for local setup evidence.

Publication was initially blocked by automatic approval review. The user explicitly authorized publishing a PR targeting dev and creating a current-sprint Notion task on 2026-10-13. Provider/device behavior and hosted CI remain separate from local validation.

## Retargeting to dev

Rebased only the two task commits onto fresh origin/dev, excluding unrelated main release changes. The independent acceptance author adapted the new auth integration fixture to dev's existing native-platform and first-launch-intro dependencies. All 14 focused tests passed; all original test bodies and 27 assertion lines stayed byte-for-byte unchanged. No production behavior changed during retargeting. Full tests, lint, and TypeScript are being rerun for this base before handback.

## 2026-10-14: PR finding, cross-tab fresh login

User request: fix findings in PR #3693. Formatting was corrected in 85215d1bc; current CI has no failed checks. Remaining finding: a tab that accepted another tab's logout retains its in-memory boundary after a trusted login removes the shared active marker.

Accepted invariants remain: explicit logout blocks account push, fresh authenticated login may attach the current account, stale or uncertain authentication cannot release logout, and generic subscription stays enabled. Runtime Plan mode is unavailable; this persisted section is the equivalent plan.

### What can go wrong

- Invalid input/auth: a missing or malformed fresh identity, failed/offline profile check, locked/demo/unresolved session, or cached former-account identity cannot release the boundary.
- Concurrency/idempotency: delayed marker removal, newer logout while verification is pending, logout/login ABA, duplicate events, and out-of-order verification completions must retain latest-account/anonymous state correctly.
- Timeouts/retries/partial failure: profile or SDK failures stay observable; retry on the next lifecycle signal. Fresh identity verification has a 10-second wait budget so offline-paused queries cannot hold reconciliation forever; late verification cannot release logout. Existing network/SDK budgets remain. Storage denial keeps the in-memory logout boundary.
- Data limits/migration: retain only existing opaque receipt/active marker, no account/token data; old bundles keep their behavior until updated. No schema migration or bulk/load workload.

Acceptance before implementation: (C1) a tab observing logout and then a shared marker removal can link the freshly verified account B; (C2) removal or stale positive sync alone cannot release logout; (C3) fresh-check rejection/null/invalid identity and newer logout prevent relinking; (C4) stale/out-of-order events and checks cannot undo a newer logout/login; (C5) AuthProvider requests fresh profile verification on marker removal and later visible/online recovery, without a notification hook; (C6) permission/opt-in remain enabled.

Plan: independent spec-only author adds frozen positive/negative tests; reproduce the current failure; implement narrow facade/provider reconciliation; independent verifier checks the finding and recovery; run regression tests, required gates, Prettier and full TypeScript; challenge the fix in a disposable copy; push to the same dev PR. No merge/deployment. Provider/device delivery remains separate evidence.

Observed follow-up: the independent actual AuthProvider/useNotifications/QueryClient harness reproduced SDK login B -> A -> B when B's SDK login synchronously emits subscription opt-in before React renders its fresh profile. The hook still supplied cached A. Additional acceptance (same latest-auth-identity invariant): ordinary SDK/hook sync hints cannot override an identity selected by trusted resume or AuthProvider reconciliation. Initial sync compatibility remains before an auth selection; subsequent AuthProvider reconciliation can intentionally select C. Freeze regression before adding this protection.

API fixture correction: the existing frozen trusted-resume test permits subsequent authorized `syncNotificationIdentity(C)`. Keep that contract and distinguish SDK hints using new `syncNotificationIdentityFromHook`, which respects the latest auth-selected identity. The independent author adapted only new CT14/15 API wiring, preserving all forbid-A/retain-B/select-C assertions; actual provider/hook/QueryClient regression C5-07 remains unchanged. No existing assertions weakened.

The verifier also reproduced B -> A -> B from a queued online task before the query observer render, with no SDK subscription event. Provider callbacks now read the current QueryClient profile instead of a rendered snapshot; unknown cache state does not reconcile. Frozen C5-08 covers that ordering with real TanStack scheduling. Four query-client mocks were adapted independently to stable client identity and getQueryData backed by their existing profiles; hashes prove all existing describe/test bodies stayed unchanged.

Verification receipts: final auth/identity regression batch passed 14 suites / 89 tests. Independent final-source review passed seven suites / 35 tests plus 11 two-context VM/fault scenarios. Mutations removing receipt, revision, fresh proof, or the hook guard reproduced forbidden identities. Test author used fresh gpt-6-astra context with no production-source access by instruction; shared filesystem isolation was not enforced. The separate verifier used real provider, hook and QueryClient scheduling.

Full local formatting/TypeScript attempts during iteration exhausted their 300-second budgets without diagnostic completion; they were not counted as passes. Serial final checks follow. Yesterday's temporary Node20 binary was externally removed; the installed supported runtime is Node22.23.2. Commit gate remains required, and exact-head hosted CI remains separate. No physical provider/device acceptance, merge or deployment is authorized by this follow-up.

Final full TypeScript passed in 195.06 seconds using supported Node22.23.2, unchanged project tsconfig/noEmit and 300-second timeout, on the host execution path. No source exclusions, compiler weakening, or budget increase. Supplemental independent current-source behavioral review passed its seven-suite / 35-test batch and 11-case VM harness; a later supported-runtime verifier turn was interrupted by a tool error and is not counted as passing. No task-owned verifier process remained in the process inspection.

Final full repository Prettier check also passed on the host execution path in 204.47 seconds using Node22.23.2 and its unchanged 300-second budget. The earlier sandbox formatting timeout is recorded above, not treated as a pass. Production source and frozen assertions were stable for both final full checks.

## Integrating live dev after publication

GitHub blocked fresh pull-request test workflows because live dev had advanced to f47d3899, while API base snapshots still showed the original fdc1307e4. A read-only merge preview identified only three add/add conflicts: quality-gates.json, NFR.md and preflight.md. Runtime changes merged automatically. Merge guidance preserves both project checklists/incident records and all upstream Screen Library checks, adds the push regression set, retains full ESLint, and extends affected-file formatting coverage. The 420-second combined gate budget is inherited unchanged from live dev; no failing check was weakened or dropped.

Live dev also retired the first-launch intro API and its unrelated intro tests. The independent test author removed only four obsolete fixture module mocks/declarations and one reset; all test-body hashes stayed unchanged. Those four fixtures passed 26 tests on supported Node22.23.2. Post-integration full checks and merge commit gate remain required before publishing the branch update. This is branch synchronization, not merging the PR or deploying production.

Post-integration full TypeScript passed in 185.73 seconds on Node22.23.2, standard regenerated Next types and exact 4cc8601 content fixtures, with unchanged compiler flags/300-second budget. Only the two generated JSON fixtures were fetched through a temporary blob-filtered bare repository; no other checkout or complete content catalogue was changed/downloaded. The combined inherited 420-second commit gate preserves both Screen Library and push checks, with full ESLint and formatting coverage of both scopes.
