# Screen updates only

Plan mode is unavailable in this client; this is the equivalent persisted plan.

## Acceptance

- A1: Gallery has a keyboard-accessible switch labelled `Screen updates only`, directly after Locale, enabled by default.
- A2: While enabled, hide PR entries with a confirmed zero changed-screen count; retain positive-count PR entries and non-PR baseline runs.
- A3: Turning it off restores zero-change PRs without resetting source, branch, locale, viewport or date. Repeated toggles are deterministic.
- A4: Share/reload the off choice using `updates=all`; absent or invalid values mean enabled. Keep this gallery preference across report links without changing report screen filtering.
- A5: Keep locale/date options usable when no entries match. Show an explicit filtered-empty message and the correct visible count. Hide the switch on report pages and real backend journey galleries.
- A6: Keep unknown or invalid PR counts visible. User explicitly selected “Keep unknown counts visible” in chat on 2026-10-13.

## What can go wrong

| Category | Trigger and invariant | Verification / decision |
| --- | --- | --- |
| Invalid inputs | Missing, negative, fractional, string or unsafe counts remain unknown and visible, never coerced to zero. Invalid URL values default on. | Table-driven boundary fixtures; user accepted unknown visibility on 2026-10-13. |
| Concurrency | Rapid synchronous changes must render the final selected state. | Repeated toggles; no new async operations. |
| Idempotency | Duplicate change events must not change content or create requests. | Compare visible links after repeated changes. |
| Timeouts | Existing index/report load fails. | Preserve current error handling; no new external boundary. |
| Retries | User repeats changes or retries page load. | Pure filtering, no new retry mechanism. |
| Partial failure | Empty filtered results must not look like missing published captures. | Explicit filtered-empty message; switch off restores entries. |
| Auth | User is unauthenticated. | Existing auth path unchanged; filtering cannot authorize access. |
| Data limits | Large index and combined filters. | One linear local pass, no per-report requests; deterministic table fixtures, no provider load test. |
| Migrations | Old URLs/index entries and report navigation. | Default-on absent parameter, off parameter round trip, legacy metadata fixtures. |

## Scope and milestones

1. Freeze independent spec-derived tests for accepted behavior before production edits.
2. Add switch and filter using existing viewer conventions; resolve unknown-count decision before dependent code.
3. Run regression suite and relevant lint/format checks; challenge filtering in a disposable copy; inspect desktop/mobile output.
4. Review and publish a PR against dev if GitHub access permits. Do not merge or deploy.

## Rollback

Revert the viewer change. No data migration, storage writes, new API or provider configuration is involved. `updates=all` becomes an ignored query parameter in older viewers.

## Verification methods

Finite boundary/sequence tests cover this local boolean filter; parser fuzzing, concurrent writer tests and load tests are unnecessary because no parser, writes, network request or capacity contract changes. Cross-model spec-only author uses a shared filesystem with instructed context isolation, not an enforced sandbox.

## Implementation and evidence

- Implemented A1-A6. Only confirmed zero-count PRs are suppressed. User accepted retaining unknown-count entries on 2026-10-13; additional source-blind boundary tests were derived from that decision without changing production logic.
- Independent spec-only tests authored by gpt-6-sol before production changes. Eight behavior assertions were frozen; two fixture-only corrections aligned with documented main/dev branch values and valid comparison rows.
- Node 22.23.2: all 204 Screen Library tests passed, including 12 count-boundary cases from A6 (final suite: 6.9 seconds). Initial full-suite attempt stalled in the macOS Git launcher; stopped only those local test processes and reran with the direct Xcode Git binary in PATH.
- ESLint for changed test files, JavaScript syntax, Prettier and git diff whitespace checks passed. Public viewer files are excluded by repository ESLint configuration.
- Disposable mutation replacing the zero-count filter with unconditional visibility fails A2 as intended.
- Chromium local fixture preview passed desktop/mobile, native keyboard toggling, off-choice reload persistence and no page errors or mobile overflow; screenshots in /private/tmp/screen-updates-preview/.
- Aggregate configured research checks (matrix verification and artifact lint) passed separately. Stop hook reported source/Git fingerprint budget exhaustion; no hook configuration or protection was changed. These manual check results do not establish a successful hook run.
- No live deployment, merge or provider changes. The unknown-count question is resolved.
- Added a worktree-scoped `.codex/quality-gates.json` with a 120-second total budget for the full Screen Library suite, changed test-file ESLint, viewer syntax and formatting. The first commit hook inspected the aggregate workspace despite tool workdir; the next attempt explicitly targets this worktree using `git -C`. No global hook was modified or bypassed.
- Correctly scoped commit succeeded through the active PreToolUse hook, including configured checks and before/after fingerprint validation. The aggregate Stop hook remains a separate known limitation of the root scope of this chat.
