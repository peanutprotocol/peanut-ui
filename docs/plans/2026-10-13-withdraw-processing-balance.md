# Withdrawal balance warning during execution

User request: do not show a false insufficient-balance message before withdrawal success.
Evidence: Android release b105626, 2026-10-13 11:39 UTC: confirmed, settled, completed; review screen still renders while live balance changes.

## Acceptance

- A1: A real balance shortage before execution remains visible and blocks confirmation.
- A2: While execution/recording is processing, live balance changes never show an insufficient-balance warning; confirmation remains disabled.
- A3: Once funds moved, the warning stays hidden during bookkeeping recovery; a real recording error remains visible and record-only retry remains available when idle.
- A4: If processing ends without executed funds, ordinary balance validation resumes.
- A5: Apply the same contract to Withdraw and Send framing. Do not change signing, balance calculations, broadcast, duplicate protection, or provider contracts.

## What can go wrong

| Category | Trigger and expected behavior | Impact / verification | Decision |
| --- | --- | --- | --- |
| Invalid input | True insufficient balance before execution stays blocked; amount parsing unchanged. | Preserve existing amount tests and idle warning assertion. | Existing contract |
| Concurrency | Balance refresh races processing or success navigation. Hide obsolete warning; keep processing CTA disabled. | Rerender transitions and boolean state matrix. | User requested fix |
| Idempotency | Repeated taps during processing invoke no confirmation callback. | Disabled CTA/callback assertion; execution guards unchanged. | Existing contract |
| Timeouts | Execution outcome unknown or recording delayed. Processing must not imply a balance error. | Processing warning test; existing timeout flow unchanged. | Existing contract |
| Retries | Funds moved but recording failed. Show actual error and allow record-only recovery when idle. | Settled/error/retry assertions; no broadcast changes. | Existing contract |
| Partial failure | Processing fails before funds move. Restore genuine balance warning. | Rerender from processing to idle. | Existing contract |
| Auth | No identity, cache ownership, or server authorization changes. | Not applicable to presentational guard; inspect diff. | Existing contract |
| Data limits | Constant-size render predicate; no new queries or retained data. | Exhaustive finite boolean matrix; no load test needed. | Existing contract |
| Migration | Optional existing props retain defaults; older callers retain idle validation. | Existing component tests; no schema migration. | Existing contract |

## Plan and verification

1. Use an isolated checkout based on current origin/dev; preserve the user's dirty checkout.
2. Fresh spec-only test author uses gpt-5.6-sol; primary agent implements separately. Filesystem isolation is not enforced.
3. Run acceptance tests against baseline and observe the actual warning defect.
4. Make the smallest component change and run focused tests, lint, formatting, typecheck, applicable project checks.
5. Challenge the warning guard in a disposable copy and verify tests fail.
6. Publish a PR assigned to innolope-dev; no merge or deployment authorized.

Plan mode switching is unavailable in this client; this file is the equivalent persisted plan.
No undecided business policy. Rollback is reverting the component guard; no data or backend rollback required.
Fuzz/load tests are inapplicable to a finite presentation state change. Native device verification remains separate from component verification.

## Verification evidence

- Spec-only gpt-5.6-sol author produced 13 acceptance cases before production edits; primary GPT-6 agent implemented. Shared filesystem context isolation only.
- Baseline: 7 acceptance failures, 6 passes; actual warning and processing-Retry defects reproduced.
- Fixed: 82 tests passed across acceptance, existing confirmation component, and crypto withdrawal route suites (30.4 seconds, Node 22.23.2).
- Disposable mutation: removed the processing-warning guard; 4 acceptance failures, 9 passes (21.6 seconds). The working implementation was not mutated.
- Full ESLint passed with 64 existing warnings; changed-file ESLint and Prettier passed. DS lint and screen wordiness checks passed.
- Repository-wide Prettier passed. Screen tooling: 183 tests passed after selecting the installed Git executable directly; the initial attempt was cancelled because the default macOS Git launcher repeatedly invoked Xcode with sandbox cache errors.
- Initial TypeScript check found only two missing generated content manifests in the uninitialized submodule. Restored those exact files from pinned content revision 8c8e4933a18de1614540a1f3a00d1c243efc0e1c using local Git objects, without changing the user's content checkout; full TypeScript rerun passed.
- Aggregate configured research checks passed: matrix verification and artifact lint. They do not validate withdrawal behavior.
- No hook changes, live transfers, deployment, or native/device validation performed.
