# Open PR review fixes

Date: 2026-11-04. Scope: Wallet UI3949/API2026 and accounts badge UI3947; companion mono card documentation. No merge/deployment/native build. Existing attention guard remains protected. The active client cannot switch Plan mode; this is the saved equivalent before production edits.

## Outcome and acceptance

Frozen contract: /tmp/pr-findings-acceptance-2026-11-04/accepted-spec.md. W1 pending lookup suppresses fallback; W2/W4 coarse last-four/Rain/history never proves current exact card; W3 exact add result gives current-flow status; W5 cancellation/duplicate safety; B1/B2 truthful bank badge/destination; C1 registered capture coverage. Current owner accepted conservative interpretation on 2026-11-04 while carrying out user's resolve-findings request.

## What can go wrong

| Category | Trigger | Invariant and check | Decision |
|---|---|---|---|
| Invalid inputs | last-four collision, missing/coarse wallet facts | keep Add, never claim Added; W2/W4 | accepted conservative fallback |
| Concurrency | delayed A lookup, card switch, duplicate tap | cancel stale state; one exact add; W5 | preserve existing fences |
| Idempotency | repeated taps / exact already-added answer | one provisioning side effect, successful status; W3/W5 | accepted |
| Timeouts | stalled native availability | pending state suppresses manual row; five-second bounded fallback | accepted 4 November |
| Retries | cancellation/failure | keep retry action, no automatic re-add | accepted |
| Partial failure | successful add, failed refresh | preserve success; no false persistent proof | accepted |
| Auth | logout/replacement during await | no old card grants/status overwrite; retain ownership | existing contract |
| Data limits | catalogue generation from partial env | no unrelated states removed, snapshot equals real registry | accepted |
| Migration | old binary/flag/API | manual fallback; no new binary/API order dependency | accepted |

## Milestones

1. Inspect live threads/checks, exact branches and existing dirty files; preserve unrelated work.
2. Freeze spec; fresh different-model spec-only tests through parent after slot frees. No filesystem isolation claim.
3. Reproduce failures with focused tests, implement fixes, regenerate exact capture metadata and concise copy without weakening gates.
4. Focused affected tests/lint/format, required supported commit guards; push existing PRs. Full mirrored suites use hosted CI.
5. Companion mono docs PR if needed; reply/resolve verified findings, wait for current-head review and checks. Preserve Wallet after Release167.

## Baseline

UI3949 898e41ce2: 2 unresolved threads; API2026 90024f6a8: one unresolved coarse-device-proof thread; UI3947 cc57ff359: 2 unresolved threads. Attention UI3921/API2016 no unresolved threads; UI guard requires human independent workflow review. H9 API2023 merged during investigation.
Badge checkout's pre-existing capture-catalogue.json diff has 280 insertions/1299 deletions (mtime 17:36:58); preserve original and inspect rather than resetting. Local branch name differs from PR branch; push exact intended ref only.

## Assumptions

Conservative explicit unknown behavior may show Add again on reopening even for an already-provisioned card; exact native add handles that safely. No persistent recognition claim.

## Accepted behavior and verification

- Pending lookup hides manual fallback. The initial native read uses the prior five-second confirmation budget. On timeout or rejection, manual fallback returns; late results are ignored. The parent accepted this recovery bound on 4 November.
- Only an active exact-card native add result publishes Added. Neither Rain card-wide wallet names nor historical local records strengthen a suffix match. Reopening may offer Add again. Android performs its exact check when tapped; iOS keeps manual fallback when it cannot add. Another available Apple target keeps Add.
- Bank fixable-rejection remains Action needed with an endorsement-pending claim, matching the actual destination. Nonactionable pending/ready reviews retain Under review.
- The unused Rain wallet reader and local-history helper are removed. API2026 is superseded after the UI correction is pushed; its branch/history stay preserved. The parent approved this cleanup on 4 November.

Independent author configured as gpt-6-astra, no inherited chat, packet-only instructions. The inherited implementer model identity is not exposed; actual model difference is unverified. Shared-filesystem context separation is not enforced isolation. Frozen assertions live in wallet-review.acceptance.test.ts and bankBadge-review.acceptance.test.ts. Adapters render real UI/hooks and call the real depositGateView destination. Source-informed recovery coverage is separate in wallet-review.recovery.test.ts.

Baseline: 9/29 Wallet acceptance failures; badge 1/4 failure (review badge with action destination). Corrected focused runs: Wallet/card/catalogue106 tests; badge76 tests passed. Capture metadata preserves all prior ids/values and adds only relevant states. Wordiness returns to259 without a baseline change. Dev-only Wallet surfaces gain a visible title so the existing text/image readiness completes; capture guards stay unchanged.

Breadth: two same-last4 synthetic cards, two platforms, deterministic asynchronous fault/cancellation/duplicate cases. No parser fuzz or load test: no parser or capacity feature changed. The deliberate suffix-to-Added regression in a disposable hook copy failed the frozen same-last-four case as expected. Required gates and exact-head hosted results are recorded after execution.

## Not handled

Native/device/provider validation and deployment remain unperformed. Persistent exact-card recognition cannot be established by the shipped native lookup. Full mirrored suites run in CI per user preference; configured local guards remain required.

## Verification setup evidence

The unchanged notification init-recovery guard loaded/reset its dependency graph inside each timed async test; a disposable profile measured 3911ms in loading out of 4257ms total, with an earlier cold run exceeding the unchanged five-second deadline. The fixture now loads fresh paired React/RTL/hook modules in beforeEach, preserving resetModules, all behavioral assertions and each five-second test deadline. The focused notification selection passed all eight cases. A disposable copy changing the retry budget from three to one failed at the original recovery assertion (initialized expected true, received false), establishing that the fixture change still detects the behavioral regression. Production notification code is unchanged. Both PRs include this common baseline fixture correction.

The desktop default Node26.7.0 is outside this project’s supported runtime; supported Node22.23.2 is installed. A local, unstaged gate-config override keeps every existing check and the 420-second total budget, invokes the supported absolute runtime through the existing low-priority heavy-job wrapper, and emits a nonsecret runtime-path/version receipt. It is machine-specific verification setup, not proposed portable repository or CI policy. Required CI remains the merge boundary.

## Independent verifier follow-up

Read-only verification of the frozen staged hook found a never-settling post-success iOS lookup and missing auth-epoch fences after native completion/refresh and initial lookup. Six source-informed cases reproduced those failures (six failing, three existing recovery controls passing). The bounded post-success lookup now uses the same five-second budget and returns manual fallback on failure/timeout while preserving a completed add result. Initial lookup compares its captured auth epoch; native and refresh results pass the existing stale-operation check before publishing state. App cancellation cannot undo a Wallet sheet already underway.

The corrected recovery/frozen acceptance/original hook selection passes72 tests in three suites. The first full configured guard completed and signed local bc05ab745 before the requested stop reached its already-exited formatting process; that commit is not pushed. This receipt covers the old patch only. The follow-up requires a fresh configured guard and current-head CI.

The hosted badge check exposed a shared frozen-test integration import: @jest/globals is not directly declared in this repository. Only that import is removed in Wallet; ambient repository Jest globals supply the same functions and all frozen assertions remain unchanged. The optional targeted TypeScript diagnostic was stopped at its two-minute bound while loading real imports under concurrent automatic hook fingerprinting; it emitted no diagnostics and is not a pass. Complete typecheck remains required in hosted CI. The obsolete in-flight guard was deliberately stopped/rejected before this source correction; the final guard must cover it.

## Final guard timing recovery

The final 420-second guard attempt was rejected: initial fingerprint/screen checks took about125s before push-identity began; push-identity completed near210s, leaving only210s for full lint, which reached the total deadline. Later checks/final fingerprint did not complete. An automatic Stop-hook fingerprint was observed consuming I/O/CPU during that initial phase. This is not a product pass or failing behavioral assertion. In the next isolated badge run, initial fingerprint/screen work took about17s.

CONTRIBUTING.md requires one desktop test worker. The local Node test commands still used default file parallelism; the catalogue and state-coverage cases each spawn Node/tsx to load the real catalogue. The unstaged machine-local runner now adds --test-concurrency=1 to the same Node test files. Installed Node22 confirms this supported option. No test, assertion, check, scope or420s budget is removed or increased. One retry is planned after the badge lease, without another manual heavy check or automatic Stop-hook fingerprint active.

## Dedicated execution recovery

Desktop load above140 on8logicalCPUs left the catalogue compiler with6.42CPU seconds in5:24; finite420s retries were rejected without publication. The existing private personal development sandbox is resumed with a30-minute automatic lifetime, matching Node22.23.2 and an already-installed identical dependency lockfile. No environment secrets or logins are copied. Disposable validation snapshots preserve the exact HEAD, logical index, all nonignored source bytes/modes/symlinks and initialized content-submodule state. The existing installed fingerprint helper is reused for identity; host-specific physical Git HEAD/index files are replaced only by their resolved HEAD/logical-index values for cross-host comparison.

The actual local PreToolUse hook still fingerprints before/after and gates the signed local commit. Its unstaged local config transports every existing check unchanged through the existing desktop low-priority wrapper to the sandbox; Node tests use one worker. Remote identity checks bracket the run. Remote work has a fresh360-second aggregate deadline within the unchanged420-second local guard; expiration kills only its own check group. No passing result is cached or reused. Exit-code propagation, changed-source rejection and the incident catalogue loader are checked before the actual guard. This is execution setup, not a code/CI policy change.
