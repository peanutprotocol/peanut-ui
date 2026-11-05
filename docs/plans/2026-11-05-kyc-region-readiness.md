# L8: post-KYC region readiness

User brief (2026-11-05): verified newcomers must not wait 30 seconds for CUIT, terms or provider review. Finish with account-ready copy naming the remaining currency. Publish a non-draft PR against dev. Runtime Plan mode is unavailable; this is the equivalent persisted plan.

## Acceptance

- A1: After approval, a known user action (CUIT/questions, hosted verification) exits preparing promptly. Preserve dedicated terms and proof-of-address steps.
- A2: Explicit provider-review waits exit preparing with review copy. Ordinary provisioning and missing data keep bounded waiting/recovery.
- A3: Completion names the affected currency when known; review copy never promises the rail can move money.
- A4: Only a usable requested deposit rail calls onKycSuccess. Deferring an action/review closes without KYC_ABANDONED or opening a money form. Completion is idempotent.
- A5: Preserve country/intent isolation. QR or another country cannot authorize a bank operation; blocked accounts never become ready.
- A6: Fresh, reactive and legacy-session paths agree. New attempts reset completion state/timers. No backend writes or migration.

## What can go wrong

| Category | Trigger, invariant and test | Decision |
| --- | --- | --- |
| Invalid input | Missing report/action descriptor stays unknown; test no completion. | Existing truth contract |
| Concurrency | Snapshot changes during refresh; close/unmount/new attempt while awaiting. No stale modal or duplicate completion; deferred refresh tests. | Preserve lifecycle |
| Idempotency | Repeated Continue/approval cannot repeat callbacks or analytics; hook tests. | Required |
| Timeouts | Actions/reviews cannot settle in 30 seconds; provisioning retains recovery. Fake timers beyond 30 seconds. | Explicit brief |
| Retries | Failed fresh fetch is unknown; keep existing polling budgets. Fault tests. | Existing NFR |
| Partial failure | Identity succeeds but account cannot move money; show remaining step without money-flow callback. | Explicit brief and callback contracts |
| Auth | No new endpoints/cache/identifiers; synthetic fixtures and no personal telemetry. | Existing boundaries |
| Data limits | Finite report/account set, unique currency labels, no extra network/batch work. | Required |
| Migration | Additive optional UI props; older reports stay unknown. | No migration |

Failure list presented in chat for edits before implementation. No missing policy decision blocks the explicit fix; silence is not approval of a new policy.

## Plan and verification

1. Fresh spec-only test author on a separate available model; tests before production edits. Context separation only, shared filesystem.
2. Separate setup completion from rail usability across fresh/reactive/session paths; localized notice and deterministic screen states.
3. Focused Jest, affected lint/format, deterministic timer/fault cases and disposable mutation. Keep CI-equivalent suites in GitHub per user preference and preserve commit guards.
4. Preflight, commit only this work, push and publish ready PR; inspect current-head CI/review. No merge/deployment.

Rollback: revert UI change; no schema/provider changes.

## Evidence

- Spec-only test author: gpt-6-astra, fresh context, no implementation reads before frozen tests. Initial 25 behavioral failures reproduced the missing notice, stuck preparation, duplicate money callback and failed-refresh handling. Shared filesystem means context separation, not an enforced read boundary.
- Focused verification: 102 tests across seven hook/component/catalogue suites passed on Node 22.23.2, including the final generic-RFI and terms-to-review corrections checked against related hook/supplement/terms suites. Changed-file ESLint and Prettier passed. Full repository suites, typecheck and Screen Library captures run in hosted CI, per user preference.
- Separate finder review followed by parent verification reproduced provider-pending session timeout, unrelated region review triggering money success, and late terms confirmation reopening the modal. Added regressions pass. No-SDK initiation now reads the newly selected country synchronously.
- Disposable mutation: replaced notice classification with null in /private/tmp/peanut-l8-mutation. The questions-action acceptance test failed on the expected null notice; production copy was untouched. An initial mutation run could not resolve dependencies; linking the existing dependencies corrected the harness before recording the behavioral failure.
- Breadth: deterministic action/state cases, fake timers beyond 30 seconds, close/new-attempt/unmount fault sequences and legacy-session cases. Parser fuzzing and load tests do not apply to this finite local UI classifier; no new network boundary or capacity-sensitive work.
- Existing configured local gate files were retained. No Git hook is installed in the shared repository; app hook runtime trust/activation was not changed or certified. Required hosted protections remain the merge boundary.
- Test-spec correction independently approved by the original author after inspecting the public NextAction contract and dedicated supplement dispatch: only `supplement:*` Sumsub actions have a dedicated proof-of-address step. A generic Sumsub RFI is a remaining user action too; its additional red regression was implemented without relaxing the existing tests.
- Publication and hosted results pending at commit time. No merge, deployment, live provider or physical-device validation requested or claimed.
- Initial hosted checks passed TypeScript, ESLint and formatting. The screen suite exposed the generated capture catalogue missing the two newly registered states (544/545 passed); regenerated it from the live catalogue. The advisory wordiness ratchet sums every mutually exclusive modal phase and measured 28 additional words across the new action/review variants. Updated only this component baseline from 186 to 214 through the documented generator; each added frame remains concise, and the rationale is in the PR.
- Hosted head 29c7dbc9ac71 passed all 17,514 unit tests, Screen Library tests, copy budget, typecheck, ESLint, formatting and native export. Its press-contract build failed with heap exhaustion before browser specs ran; existing PR #3957 owns the browser-build heap fix. No speculative retry or workflow budget change was made here. A superseded i18n job ignored automatic cancellation and held the new run pending; force-cancelled only the superseded run and confirmed it terminal with no active jobs.
- Final reactive regression: when an accepted-terms account later becomes an explicit provider review, the terms phase must also end. The added test failed on the old terms phase and passes after applying the same notice transition there; stale terms-close callbacks cannot restart that completion. Chip reviewed head 29c7dbc9ac71 with no findings and no unresolved threads; the runtime follow-up requires a new current-head review.
