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
