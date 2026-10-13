# Screen Library state coverage and zero-difference gate

## Accepted behavior

- Capture a card application requiring information with `reasonCode=card_needs_review`, so the reason copy is visible when that reason is mapped.
- Capture withdrawal review with insufficient balance both while idle and while processing or already spent; the latter states expose the warning suppression in PR #3692.
- For future PRs with UI source changes and zero visual differences in every supported locale, fail the Screen Library check. A nonempty `Screen Library exception: <reason>` line in the current PR description allows the intentional zero-difference case. The report remains available.
- Keep the existing exact-head provenance, four-locale completeness, and trusted publisher boundary.

## What can go wrong

| Category | Failure / required response |
|---|---|
| Invalid input | Missing, blank, or malformed exception must fail; malformed or incomplete comparison cannot count as zero difference. |
| Concurrency | Superseded PR heads must not be gated or accepted from stale artifacts; use existing provenance binding. |
| Idempotency | Re-running the same PR/report gives the same gate decision and does not duplicate or mutate screen scenarios. |
| Timeouts | A timed-out capture is incomplete, never evidence of no visual change. |
| Retries | Retry only failed capture/publish work; do not add a second four-locale matrix for the gate. |
| Partial failure | Keep immutable reports and index reconciliation even when the policy check fails after publication. |
| Auth | Do not trust PR-controlled artifacts or text for executable code; exception is plain text and current PR metadata only. |
| Data limits | Use current comparison manifests and bounded PR changed-file lookup; no real applicant or transfer data. |
| Migrations | New scenario IDs enter the existing catalogue and produce added/new states; no stored-data migration. |

## Acceptance before implementation

1. Catalogue exposes distinct stable IDs for the card reason and three withdrawal review lifecycle states, all captureable under each supported locale.
2. Card scenario sends the reason code to the same component used by the card page. Withdrawal scenarios send `insufficientBalance=true` with idle, processing, and already-spent variants to the same review component used by the flow.
3. Gate fails a UI-source PR with complete, all-zero comparison counts and no valid exception; passes with a nonempty exception or any genuine visual difference.
4. Gate does not apply to non-UI PRs or integration/main runs, and neither a partial capture nor stale PR metadata can be reported as passing zero-difference coverage.
5. A deliberate failing variant proves the gate acceptance test catches a removed protection.

## Implementation and verification status

Plan mode is unavailable in this client; this file is the persisted equivalent. A fresh spec-only test author used `gpt-5.6-sol`, distinct from the implementer, with shared-filesystem context separation rather than enforced isolation. The authored suites failed behaviorally against the initial catalogue and a contract stub, then passed after implementation.

- The two linked historical reports each contain 296 unchanged registered states. The card capture omitted `reasonCode=card_needs_review`; the withdrawal capture stopped before `ConfirmWithdrawView`. New scenarios cover those exact inputs, including idle, processing, and already-spent balance states.
- The publisher uses exact, live PR provenance and its existing comparison manifests. It writes immutable reports and its PR comment before throwing on a failed zero-difference gate. A new state without a historical baseline is reviewable as `new`; a failed or unavailable current capture is not.
- Local verification: 201 Screen Library tests and 30 focused card/withdrawal component tests passed; affected ESLint and Prettier passed. Deterministic property workload: seed `0x36853692`, 512 locale/count permutations; malformed count fault set of seven cases; 2,001 changed-file entries in the bounded list check. A disposable mutation that made the zero-difference branch pass caused three acceptance tests to fail.
- Full TypeScript check is not green in this checkout: 214 diagnostics arise from missing dependencies/generated asset declarations, with no diagnostics in changed files. The local production build made no progress after four minutes and was stopped. A localhost dev route then failed to compile because the shared dependency installation lacks `@capacitor/share`; no rendered screenshot was obtained. Hosted exact-head capture and CI remain pending.
- Concurrency testing was skipped because the pure gate has no shared mutable state; idempotency and exact-head provenance are exercised by deterministic gate and existing publisher tests. No load beyond the bounded 2,001-file list was run because the gate adds no network or capture work. No hook was installed or activated.
