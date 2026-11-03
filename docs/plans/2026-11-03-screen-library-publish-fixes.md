# Screen Library publishing failures

User specification: fix delayed closed/merged PR publishing, expose sanitized deployment errors, investigate migration failures using code and recorded logs. Branch innolope/screen-library-publish-fixes from c4a115aed only. No remote Cloudflare operations, workflow dispatch/rerun/cancel, or merge. Preserve security/integrity gates and permissions. Plan mode switching is unavailable; this document is the equivalent plan.

## Acceptance criteria

- A1: A same-repository PR matching the run's exact head, branch, dev base and event PR number (when present) that is closed/merged exits baseline resolution successfully, emits a notice, and outputs mode=skip. Never search/download a baseline or publish afterward.
- A2: Open-but-unresolvable, missing, stale, mismatched, ambiguous or invalid provenance still fails. Existing exact open PR baseline verification remains intact. Push behavior remains intact.
- A3: Every remaining publish step and dependent job honors skip through the publish job output. Handle PRs with and without current before captures.
- A4: Failed deployment operations expose useful sanitized command diagnostics and nonzero status. Redact environment secrets/tokens/account IDs, credential-labelled values, bearer tokens and account identifiers. Preserve progress, 270-second command timeout, 5-minute step and 10-minute job budgets, and zero automatic retries.
- A5: Inspect recorded failures and migration/tool code. Change the underlying cause only with evidence; otherwise explain unknown provider state and what the next failure will reveal. No remote validation.
- A6: Run focused Node acceptance, full screens:test with CI dependency setup, affected Prettier/ESLint, and configured applicable checks. Signed commits, one PR to dev, no merge. Expect backdoor guard to reject workflow edits by design.

## What can go wrong

All behavior decisions below come from the user's explicit request and existing NFRs; no pending business decision is inferred from silence.

| Category | Trigger and invariant | Impact / proposed test | Decision |
| --- | --- | --- | --- |
| Invalid inputs | Malformed revisions, missing candidates, wrong branch/base/repo/head/number, ambiguous candidates must not skip | False successful publish; exact negative fixture matrix | Accepted A1/A2 |
| Concurrency | PR closes before delayed resolver; closes again after lookup | Skip the observed exact closed PR; publisher retains live provenance recheck for subsequent races | Accepted A1; no atomic GitHub snapshot possible |
| Idempotency | Replayed closed run or migrations | Repeated skips have no publication; inspect additive SQL and migration ledger locally | Accepted A1/A5 |
| Timeouts | Deployment stalls, API read errors | Keep bounded operation and progress; never report failure as success | Accepted A2/A4 |
| Retries | Transient or terminal command error | Keep retry=0 and no automatic repeats; preserve error code | Accepted A4; existing NFR |
| Partial failure | Command changes remote state then fails | Diagnostics say failure/unknown; no rollback or speculative retry | Accepted A4/A5 |
| Auth | Wrong PR repository or diagnostics contain credentials | Exact binding and redaction tests, never broaden permissions | Accepted A1/A2/A4 |
| Data limits | Paginated candidates, oversized/noisy logs | Preserve paginated lookup; bound diagnostic output while retaining useful error text | Accepted A2/A4 |
| Migration paths | Reapply 0001/0002/0003, tool/config mismatch | Inspect prepared paths and locked Wrangler code; local SQLite replay where available | Accepted A5 |

## Milestones and verification

1. Install frozen dependencies; inspect NFR/preflight, resolver, workflow, migration/tool sources and existing successful/failed logs.
2. Freeze spec-only acceptance tests with a fresh different-model author before production edits. Run red tests serially. Shared filesystem isolation is advisory only.
3. Implement exact closed-run handling and workflow gating; implement sanitized failure diagnostics preserving budgets. Fix migration cause only if established.
4. Run focused/full tests one process at a time, lint/format, relevant configured gates and disposable mutations for skip/error redaction invariants. Inspect defect-class search hits and all call sites.
5. Record evidence and limits; signed commit, push this branch, open one PR against dev with failure evidence and expected guard failure.

## Migration and rollback

No schema/data migration, dependency upgrade or remote action is planned absent evidence. Reverting this code restores prior behavior; no remote effects occur during local work. Existing gallery is untouched. Hosted CI and provider acceptance remain separate from local evidence. No hook installation/trust/runtime change is requested.

## Verification record

- Frozen install and isolated deploy npm ci passed; temporary Worker dependency symlink was used only for local verification.
- Fresh spec-only tests were written before production edits, then extended for current captures. Shared filesystem isolation was advisory. Finder and verifier roles were separate; their reachable privacy findings were reproduced and fixed. Existing workflow-test shape corrections were independently checked against A3.
- Initial closed-run tests reproduced the unresolved-base failure. An initial legacy-helper fixture also exposed orphaned-sleeper test timeouts; the checked-in helper cleans up its sleeper. The first full run had two assertion-shape failures (scalar deploy dependency and an incorrectly sliced job); corrected without weakening the required index dependency or downstream settings.
- Final `pnpm screens:test`: 539 passed, 0 failed (10.7 seconds). Focused runs passed 46 tests, then 63 tests; privacy property/tail regressions passed afterward and are included in the final suite.
- All eight `.codex/quality-gates.json` checks were run explicitly and passed: 168-test Screen Library subset; 27 notification/auth suites, 172 tests; full ESLint; explicit viewer/history ESLint; viewer syntax; configured formatting; five numeric-contract tests. No Git hooks are installed beyond sample hooks; no hook installation, trust or runtime activation was changed or claimed.
- Affected `npx prettier --check`, affected `npx eslint`, `bash -n scripts/screens/deploy-operation.sh`, and `git diff --check` passed. Markdown is excluded by the repository's existing Prettier configuration.
- SQL: all three migrations replayed three times in local SQLite with foreign keys enabled; passed. Wrangler source confirms ledger filtering and successful no-pending return. No evidence establishes a remote migration lock, SQL failure or necessary version change.
- Recorded logs inspected: PR runs 41679094911 and 41670257738; migration failures 41495459992, 41640020827, 41663517701, 41669769475, 41670158647, 41672182616. All migration failures show only the banner, then exit 1 after about six seconds. Run 41670052139 at 6dba7ce66 skipped publishing/deployment; other inspected successful jobs also skipped migration, so they do not prove successful D1 execution.
- Wrangler 4.40.2 `executeSql` sets logger level to error for JSON ledger setup/reads and restores it only after success. Main handles some API errors using log, which can suppress their console reason. Private log records are still appended. This explains missing diagnostics as a code path, not the original remote failure.
- Deterministic property sweep: 256 credential variants, seed 0x3912; passed. Large console output and >256 KiB / >4 MiB private-log fixtures verify bounds and withholding. Private logs are read whole up to 4 MiB, never from a truncated tail; oversized files emit an explicit limit message.
- Disposable mutations: passing baseline, then disabling closed skip, redaction, debug filtering, failure-status propagation and publication gating each failed the corresponding tests. An initial disposable fixture lacked node dependencies and was discarded; the corrected passing baseline preceded every recorded mutation. Source worktree was never mutated for these challenges.
- Separate red/green reproductions confirmed nested debug-record headers and truncated large-record leakage before the privacy fixes. Timeout status 124 is terminal with no success receipt or retry. Full 270-second waiting, provider fault injection, concurrency/load against live systems and UI/device tests were not run: these changes have no UI or new parallel writer, and remote operations are prohibited. Budgets/progress are verified with local command fixtures and workflow checks.
- `pnpm typecheck`: failed on missing image-module declarations in the existing application. A disposable original c4a115aed snapshot produced the identical 176 TS2307 image-module errors (both exit 2); no unrelated source changes were made. The first archive attempt rejected external guidance symlinks; the successful snapshot excluded only those six guidance symlinks, with all application files preserved.

## Assumptions

The dev push run owns publication of merged state, as specified by the user. Operation completion precedes reading Wrangler's private log. PR identity is determined only from the trusted run/API snapshots and exact matching fields; no atomic GitHub snapshot is claimed.

## Not handled

The actual remote D1 error and remote migration/auth/lock state remain unknown. The next failed operation exposes sanitized user-facing errors and codes, phase, elapsed time, retries and exit status. No remote Wrangler command, Cloudflare API call, deployment/dispatch/rerun/cancellation, provider acceptance, merge or hook activation was performed. Hosted CI is separate from local evidence. Full TypeScript checking retains the 176 baseline image-module declaration errors described above.
