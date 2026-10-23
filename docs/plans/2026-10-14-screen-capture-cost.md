# Screen Library capture cost

User authorization: on 2026-10-14, implement recommendation 1 (skip known nonvisual changes), 2 (reuse a verified before capture), and 4 (target affected screens). No change to the additional viewport baseline schedule, no draft-PR policy, no batching, no merge or deployment.

This client cannot enter Plan mode. This document is the equivalent implementation plan.

## Accepted behavior

- AC1: Decide before capture dependency/browser installation. Changes solely to documentation, test-only files, unrelated CI, or the library viewer/index skip app capture. Capture tooling, fixtures, render configuration, assets, translations, content and unknown paths are never classified nonvisual merely by extension.
- AC2: Reuse only a retained, complete, trusted exact-before capture with the same harness, fixtures, renderer/environment, locale, profile, adapter, origin and device. Missing, expired, corrupt or incompatible evidence causes a fresh before capture. Reuse does not change the original commit or capture provenance.
- AC3: PRs with a provable impact graph capture every registered state in affected flows in all four locales at the default viewport. Compute influence transitively, include both revision graphs and both sides of removals/renames. Shared or unknown impact falls back to full. Dev/main visual pushes retain full after libraries; main releases and manual captures retain full coverage.
- AC4: Targeted reports explicitly record their screen scope. They remain globally incomplete and can pass the PR gate only with exact, trusted selection coverage for all four locales. Omitted states cannot count as removed, unchanged or tested. Zero differences still require the existing explicit exception.
- AC5: Baseline selection and compatibility failures are observable; never convert an inaccessible provider/API response into proof of absence or a passing skip. Preserve current-head publication checks, artifact integrity, trusted publisher separation and index recovery.
- AC6: Existing full/legacy reports, baseline workflows, collections, immutable assets and branch latest pointers remain compatible. Targeted PR reports cannot become full integration baselines or replace a full-library latest pointer.

## What can go wrong

| Category | Trigger and invariant | Verification | Decision |
|---|---|---|---|
| Invalid input | Malformed paths, revision IDs, duplicate/unknown screen IDs or an incomplete diff must not produce a safe skip or targeted pass. | Negative fixtures and parser/property cases. | Conservative full capture or visible failure. |
| Concurrency | Base/head moves or another run publishes first. Bind decisions and reports to immutable revisions; retain current-head checks. | Stale revision/provenance fixtures. | Existing exact-head boundary preserved. |
| Idempotency | Duplicate runs or retries must not overwrite provenance or shared latest with a scoped report. | Determinism, caller immutability, duplicate artifact cases. | Immutable assets/reports and serialized indexes. |
| Timeouts | GitHub/baseline/download or capture stalls. Never treat a timeout as a negative fact. | Fault injection; bounded process/API operations. | Fail visibly or bounded fresh capture. |
| Retries | Retrying publication must not rebuild successful captures; fallback must not loop. | No-candidate/incompatible/error cases and finite budgets. | At most one fresh-before fallback per locale. |
| Partial failure | A locale, artifact, download or selected state fails. Do not pass a partial matrix. | Missing locale/state/assets, incompatible baseline, failed selected state. | Four-locale scope completeness required. |
| Auth | Fork/untrusted source attempts baseline or publisher access. No extra secret reach. | Existing trusted-source verifier and negative provenance tests. | Preserve publisher-only credentials. |
| Data/resource limits | Large diff/graph/capture list, retention expiry, duplicate artifacts. No silent truncation, cap or infinite traversal. | Bounded generated workloads, cycle/permutation checks. | Unknown/overflow fails closed; no paid full dispatch for testing. |
| Migration | Old reports lack scope metadata; old baselines or new scoped artifacts are selected. | Legacy/full/targeted compatibility cases. | Legacy full behavior retained; scoped capture cannot serve as full baseline. |

Failure list presented in chat before production implementation. No missing business decision blocks the accepted conservative behavior; these are reviewable engineering defaults, not a claim that silence approves new policy.

## Plan and verification

1. Freeze public contracts and independent positive/negative acceptance tests before production code. Test author: fresh gpt-6-astra context; implementer: gpt-6.1-sol. Shared filesystem context separation is not enforced isolation.
2. Implement planning/filtering and explicit report scope; wire capture and the trusted publication gate.
3. Implement verified baseline reuse and finite fallback for PR and branch pairs, preserving full integration libraries.
4. Run focused and full Screen Library tests, configured quality gates, lint, format, TypeScript, workflow validation, bounded generated/fault cases, and a disposable failing-guard variant. Inspect incident-based preflight checks and all affected callers.
5. Independent finder and verifier review, fix confirmed findings, then publish a PR assigned to innolope-dev. Hosted captures and activation remain separate from local evidence. Do not dispatch expensive capture runs merely to test the cost-reduction patch.

Rollback: revert the workflow/planner/scope/reuse patch; existing immutable full reports and baseline schedule remain usable. No product data migration.

## Evidence and open verification

- Baseline: dev 111465d0d26fddcb6ffcb6f8a4a7b5cadd96175b.
- Successful integration run 38545091100 had eight capture jobs using 164.13 elapsed runner-minutes; PR run 38573524506 had four capture jobs using 84.4 runner-minutes and failed later resolving a closed/current PR binding.
- Current --only capture is diagnostic and materializes other screens as unavailable. Scope must be explicit; do not relabel this as a full successful report.
- Verification results and remaining hosted boundaries are recorded below. Delivery remains a draft PR until required hosted verification is complete.

## Verification progress and observed failures

- Independent spec-only author froze 21 cases (seed `0x51c0ffee`, 64 cyclic graph/permutation workloads). Baseline: 3 passed, 18 failed, 0 skipped; implemented pure contracts: 21 passed, 0 failed, 0 skipped.
- Disposable stale-baseline mutation removed the exact-before commit guard: 20 passed, 1 failed, 0 skipped. The shared checkout was never mutated.
- Configured auth/notification Jest checks: 23 suites, 132 tests passed (64.03s); product auth source is unchanged.
- Final Screen Library suite including the trusted routing adjustment: 259 passed, 0 failed/skipped (66.30s). Exact configured screen test command: 85 passed, 0 failed/skipped (4.91s).
- Concurrent ESLint/TypeScript jobs exceeded the configured 420-second budget and were stopped. Serial ESLint passed in 97.29s with 0 errors and 64 baseline warnings. No timeout was increased.
- First serial TypeScript attempt failed because this fresh checkout lacked generated Next asset/route declarations. The CI workflow's existing `next typegen` preparation succeeded. The prepared final typecheck produced no diagnostics before exhausting its unchanged 420-second budget; full TypeScript verification remains incomplete. No unverified cause or passing result is inferred.
- Independent finder and verifier confirmed dependency installation contaminated the old recursive harness hash. Tracked-input hashing now excludes installed tools, includes stored font bytes/package identity, and a disposable 4,032-file dependency installation leaves the hash unchanged. Deliberate tracked-source mutation still fails real comparison.
- Independent review confirmed viewer-only skips suppressed the sole deployment path. A trusted reusable gallery path now retains delivery without app capture. The follow-up docs-after-viewer race was independently reproduced by root and fixed with complete Git revision/input comparison; newer docs allow the queued deployment, newer viewer inputs reject it.
- Transitive fixture identity includes 232 local inputs, including rail policy and Avatar constants; unknown local loading fails visibly. This is a compatibility fix, not a reduced coverage criterion.
- Actual repository influence smoke selected 30/299 withdrawal states in 55.96s. Three concurrent finder probes exhausted the explicit 120-second budget and conservatively chose full. No hosted savings/performance claim follows from local probes.
- Workspace inventory was refreshed for this checkout. Aggregate research tests/lint passed; validation-scope acceptance had 4 passing boundary checks and 1 pre-existing frozen config-hash mismatch (root config mtime 2026-10-13, unchanged by this task). Its assertion remains unchanged.
- Installed actionlint 1.7.12 rejects only three `concurrency.queue` keys in the edited publisher and extracted gallery; it also rejects that key in the original publisher. The capture caller passes. GitHub's current [concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) explicitly supports `queue: max`. The local strict check remains a tool limitation, not a passing result.
- All 35 changed/new files passed Prettier. Changed-file ESLint passed with 0 errors; the existing configuration ignores the viewer and capture TypeScript entrypoint. The full configured ESLint result above remains the configured gate evidence.
- Independent verifier confirmed the versioned length-prefix file hash distinguishes the raw-byte two-file NUL counterexample, remains order/duplicate independent, and rejects tracked-source changes while ignoring installed dependencies.
- No hook was installed, changed, trusted or activated by this task. Existing required CI/branch protections remain the merge boundary. Hosted capture, provider publication, deployment and measured runner-minute savings are not local test evidence.
- Independent final workflow review checked 13 routing cases, including PR/main/manual, visual dev, viewer/index/docs maintenance, route failure/cancellation, fork rejection and partial-publication index repair. The caller references only the already-existing dev-pinned publisher, with its existing no-input contract and matching permissions; the trusted publisher derives maintenance flags itself. The missing new reusable path on pre-merge dev is avoided without a hosted dispatch.
- The new routing CLI fixture exceeded an initial 10-second per-case limit during concurrent local checks. Its four cases now share one cold Node process and a 30-second total fixture budget, below the prior four-times-10-second aggregate budget; behavioral assertions were retained. The focused fixture passed in 6.1s. Planning and trusted index jobs also have explicit 5-minute and 10-minute budgets. The configured 420-second quality-gate limit and existing capture budgets are unchanged.
