# TASK-24355: finite request amounts

User requests a fix, regression attribution and comprehensive prevention proposal.
Plan mode is unavailable in this client; this is the persisted equivalent.
Base: origin/main 8b5e7e9de. Reuse existing clean checkout; preserve src/content submodule state.

## Acceptance
A1: 4000 USDC suggestion remains 4000 in the field, callbacks and slider calculation.
A2: malformed/missing/nonfinite amounts cannot appear as NaN/Infinity or reach contribution submission.
A3: preserve typed input ownership, valid decimal edits, locale comma handling, and repeat-charge recovery.
A4: verify history against introducing diff, distinguishing author time, merge time and unknown deployed time.
A5: propose app-wide prevention with explicit limitations of static analysis.

## What can go wrong
Presented in chat before implementation; requirements A1-A3 derive from task DoD. No new money policy selected.
| Category | Trigger / invariant | Impact / test | Decision |
|---|---|---|---|
| Invalid input | NaN, Infinity, overflow, malformed decimal; reject or empty field, never submit | unsafe money/display; table + component tests | task DoD |
| Concurrency | delayed suggestion overwrites typed amount | preserve editing ownership; existing prefill tests | existing contract |
| Idempotency | duplicate external-wallet attempts | preserve live-charge reuse; existing tests | existing contract |
| Timeouts | missing external data | keep existing loading/error handling, never invent amount | existing contract; no new reads |
| Retries | repeated render/refetch | no invalid amount emitted; rerender tests | task DoD |
| Partial failure | valid input plus unavailable conversion | preserve existing quote UX; this fix adds no provider calls | broader policy deferred to proposal |
| Auth | payer identity/ownership | unchanged server checks, no real transactions | unchanged boundary |
| Data limits | >1000 grouping and huge decimals | boundary/property tables; overflow must reject | task DoD |
| Migration | old links/default props | unchanged routes and decimal syntax, no DB migration | existing contract |

## Work and verification
1. Fresh spec-only gpt-6-astra agent authors tests before code. Shared filesystem means context separation only; root implementation is a different model.
2. Reproduce baseline failures; fix raw-versus-display number boundary and contribution execution guard.
3. Run focused Jest, parser/formatter/payment regressions, lint/typecheck and configured gates with bounded runtime. Challenge guard in disposable copy.
4. Inspect relevant source call sites and incident preflight; record checks, attribution and unverified hosted behavior.
Rollback: revert scoped source patch; no data writes or migration. No deployment authorized by this change.

## Undecided / external evidence
Live request rendering, exact deployed release date, distinct affected payer count, release-owner scheduling. Browser inspection timed out; do not claim production reproduction or money loss.

## Comprehensive prevention proposal (suggested follow-up)

1. Define raw money once: decimal string plus currency/asset and scale (or integer minor units), separate from localized display strings. Use a validated Money/FiniteNumber constructor at URL, form, API, cache and provider boundaries; TypeScript `number` alone includes NaN and Infinity. Do not brand an unchecked assertion.
2. Decode runtime API responses against schemas. Reject missing, malformed, nonfinite or inconsistent amount/rate/unit fields; check arithmetic results too. A valid finite operand can overflow after scaling/multiplication. Prices must also be positive; zero denominators are unavailable conversions.
3. Centralize amount/percentage/rate/points formatting and forbid parsing formatted output. Invalid display-only values render a localized unavailable marker, never a fabricated zero. Input components preserve an editable empty/error state. Loading, zero and unavailable are distinct states.
4. Validate at each irreversible execution boundary regardless of button state: positive finite amount, supported precision, currency/chain, authorization and current affordability. Keep server validation, idempotency and post-transfer record-only recovery. Client finite checks alone cannot enforce money integrity.
5. Introduce a scoped ESLint rule that rejects numeric conversion of known formatting results and direct money formatting outside approved adapters. Add type-aware no-unsafe-* rules gradually and ban bypass casts around validated money. Do not pretend `use-isnan`, ordinary lint, or a search for `parseFloat` proves finiteness: Number('4,000') is legal TypeScript/JavaScript and NaN is a number.
6. Build a shared contract matrix: empty/null/missing, comma decimals and grouped values, Unicode separators, malformed prefixes, negative/zero values, tiny amounts, maximum scale, overflow and stale rates. Property tests cover arithmetic and formatting invariants; deterministic fault tests cover delayed/missing provider rates, rerenders, auth changes and failed retries. Include 999/1000/4000/10000 specifically.
7. Add browser and Screen Library assertions across every registered money state and locale: no NaN/Infinity/undefined in visible text, input values or slider accessibility attributes. Exercise the real components: mocking the slider hides this incident. Check outbound payment payloads are finite and match displayed currency/amount. Run this in required CI; a text scan is a last defense, not proof of correct amounts.
8. Emit a deduplicated privacy-safe invalid-numeric event (component/operation, source field, invalid category and release only; no user amount, link, wallet or identity). Track distinct affected sessions and alert on new regressions. Stage adoption by shared components then balance/receipt/quote/cards/points surfaces. Measure remaining direct formatting/conversion callers before claiming coverage.

Suggested delivery order: current request fix and regression; runtime Money + shared display adapters; migrate high-risk money flows; enforce lint ratchet + full UI invalid-number CI + monitoring. A finite wrong amount is still wrong, so assertions must verify units and exact intended amounts, not only absence of NaN.

## Evidence and limits

- Original source regression: 3a2ad8d1dd4e0a07b0a68e43f652891fceac13ad, Juan José Ramírez, 2025-12-26 07:23:42 UTC. The previous slider used `parseFloat(tokenValue.replace(/,/g, ''))`.
- First containing main first-parent revision: 3352fe7e772da428ccb5d3ce396595eccc85590d, PR #1551 merged by Kushagra Sarathe, 2026-01-07 13:46:02 UTC. This is source integration, not evidence of deployment.
- Independent spec tests confirmed real-slider NaN at 1000/4000/10000. Because shared-checkout validation/flow runs overlapped implementation, those green results are post-fix validation, not trustworthy pre-fix evidence. No cross-filesystem isolation was available.
- Focused validation: 36 suites / 465 tests passed (95.6 seconds); raw callbacks still pass 4000 on the old grouping bug, so the confirmed NaN path is the slider calculation, not proof of a corrupted charge or lost money.
- Guard challenge in disposable copy: restored display-mode suggestion formatting and removed that boundary's raw-input guard; real-slider 4000 assertion failed on NaN%. The working checkout was never mutated.
- Breadth: deterministic separator boundaries and 32 overflow inputs (lengths 309–340), no random seed. Existing stale suggestion and repeat-charge tests passed. Live load testing is inapplicable to a local parsing/display fix; no payment or provider request was made for tests.
- Targeted ESLint and changed-source Prettier passed. Full configured ESLint passed. Current runtime is Node 26.7.0, outside package's Node 20/21 engine range; supported-runtime/hosted CI remains separate.
- Browser inspection of reported production URL timed out; live reproduction, impact count and release verification remain unknown. No commit, push, deployment, Notion status change or message to release owner was performed.
- Full Screen Library first attempt was interrupted after macOS `/usr/bin/git` repeatedly invoked Xcode and failed its cache permissions; retry uses the actual installed Git binary via a temporary PATH shim with a 180-second budget. No production code workaround or gate assertion was changed.

## Final local verification

- TypeScript `tsc --noEmit`: exit 0 (completed; no diagnostics).
- Six configured quality gates: all exit 0. Screen gate: 168 tests passed; push/auth gate: 26 suites / 150 tests passed; full ESLint, history lint/syntax and configured formatting passed.
- Changed-source/test Prettier and `git diff --check`: passed.
- Broader Screen Library: 370 passed, 6 test files failed at import because `jose` is absent (comments/votes/worker test files). No assertions were weakened or tests skipped. These are unverified, not passing. The configured subset above is distinct.
- No hooks installed or changed. Hook runtime trust/activation was not exercised; checks were invoked directly.
- No full repository Jest, supported Node 20/21 run, hosted CI, browser/device screenshots, production impact query or deployment validation. Browser inspection timed out. Those limits do not alter the passing focused numeric regressions.
- Work is uncommitted on `innolope/fix-nan-request-amount`, in the reused `<reused-checkout>` checkout. The pre-existing `src/content` submodule state is excluded from this fix.

## Expanded implementation — explicitly requested by user

The user requested all five prevention bullets be implemented in this same ready-for-review PR. The earlier section was only a proposal and is superseded by this implementation scope.

Acceptance B1: validated raw Money (currency/asset, exact scale and minor units) and FiniteNumber types; strict runtime parser rejects invalid inputs, overflow and unsupported precision/units.
B2: shared formatter family and actual monetary UI callsites use unavailable marker rather than zero/nonfinite output; formatted text is never a numeric input.
B3: shared price/rate/API-read boundaries validate numeric payloads and required fields; failed/late data never manufactures a valid rate. AmountInput conversion failure is unavailable and cannot emit a spendable converted amount.
B4: shared wallet/charge/onramp execution revalidates raw amounts and precision before optimistic cache changes or network/spend side effects; existing auth/idempotency/recovery preserved.
B5: lint rejects conversions of formatted output and raw formatting in migrated monetary display modules; rule behavior tested on invalid/valid examples.
B6: real-component tests across all four supported locales, deterministic invalid/boundary corpus, fault/rerender recovery and bounded deduplicated telemetry with no amount/identity/request metadata.

Expanded failure list presented in chat before code. User's explicit comprehensive bullets supply unavailable/error behavior and submission invariants. No business defaults for unavailable money are inferred.
- Invalid input: NaN/Infinity, overflow, prefix parses, grouping, malformed/negative/zero payment, bad asset/precision; unavailable or safe rejection.
- Concurrency: delayed rates/suggestions, identity changes, rerenders; typed values retain ownership, no stale conversion/telemetry flood; existing query keys unchanged.
- Idempotency: duplicate submits/retries retain current request keys and record-only recovery; validation adds no retry.
- Timeouts/retries: existing transport/query budgets retained; invalid successful payloads become failures, no fabricated rates; no new external request.
- Partial failure: validate before any cache/network/write effect; do not block recording funds already moved. Telemetry failure must never break rendering or payment handling.
- Auth/privacy: existing server auth unchanged; diagnostic source/category fixed enums only; strip Sentry's automatic user/request/breadcrumb context for numeric-invalid events.
- Limits: money precision integer0..36, uint256 minor-unit bound, finite number arithmetic; API numeric decoder depth32/100000 values, telemetry35 fixed combinations/runtime. Bounds reject visibly rather than truncate.
- Migration: existing raw decimal and valid formatting contracts retained; old clients/backend nullable optional fields remain unavailable. No DB migration. Existing invalid-to-zero assertions are superseded by explicit user unavailable requirement and updated with that provenance.

Roles: fresh spec-only gpt-6-astra acceptance author; separate core and UI implementation contexts. Shared filesystem isolation unavailable. Root owns integrations, lint, privacy and final verification. No source commit/push until expanded result verified; PR remains requested non-draft.

## Expanded result and review corrections

- Implemented B1–B6 in the same branch: Money/FiniteNumber and exact rational conversion; shared formatters and23 UI display modules; numeric response validation in money services and owning rate/token sources; pre-effect wallet/charge/onramp/cross-chain guards; numeric lint and all-state Screen Library guard; privacy-safe bounded Sentry diagnostics and four-locale real-component tests.
- Canonical AmountInput state is now raw decimal text. Independent tests exposed an additional scaled-float drift:4001 became4000.99. Rational conversion fixes identity and sub-cent roundtrips without parsing display labels or changing the tests.
- Independent finder review identified and root verified compatibility requirements: fixed-price direct requests carry a valid local_price while tokenAmount is optional; all179 existing registry symbols must remain valid, including USDC.e/1INCH/USD+/USDT+/W. Guards preserve these paths; regression tests cover them.
- Unknown cross-chain fee cannot be advertised as Sponsored. Pending receipt fees still show Pending with no manufactured estimate. Request-currency and Manteca seed conversions reject invalid/overflowing rates/results.
- Existing invalid-to-zero and unknown-to-sponsored assertions were corrected with explicit provenance from the user's unavailable/error requirement. Positive amounts and existing retry/auth/recovery contracts remain independently tested.
- Money raw text cap1024 was added before regex/bigint work; the decoder has depth32/value100000 limits. API Money amounts remain raw strings; exact minor units are used for signing, not JSON.
- Reviewed113 direct number-formatting leads. Migrated actual app money/rate/points displays; Date/geometry/marketing/dev-only formatting remains outside the monetary adapter rule. Lint detects known formatter-output numeric conversions, and prevents raw formatting in migrated display modules; it does not claim arbitrary JavaScript arithmetic can be statically proven finite.
- Monitoring uses fixed source/category warning events; no raw amounts or identity are included, and the export handler removes Sentry's automatically attached context. No live alert thresholds were guessed or changed.
- This client cannot switch Plan mode. Spec-only test author used a fresh gpt-6-astra context; implementation contexts share the filesystem, so filesystem isolation is not guaranteed.
- Verification encountered one transient ENOSPC write error (failed run, not passing). Diagnostics preserved; later bounded reruns completed. Locked Worker dependencies were installed with lifecycle scripts disabled after restricted-network DNS failure; the approved network retry succeeded. No runner deployment or app publication was dispatched.

## Publication verification ledger

- Final financial regression selection:99 suites,1308 tests passed (104.4s), including wallet signing/spend/recovery, payment flows, add-money/withdrawal, charge/request services and execution-rate actions. The three pending-fee failures from the earlier broad run were fixed; this final full selection is green.
- Focused numeric/submission/locale run:32 suites,495 tests passed. Follow-up exact/receipt/UI run:16 suites,355 tests passed. Final amount/parser/payer subset:16 suites,280 tests passed. These selections overlap; counts are not additive.
- Independent registry suite and core money/decimal suite:317 tests passed, covering all179 unique supported registry symbols and the1024-character bound. Exact rational oracle seed24355; earlier256-case minor-unit oracle and128-case conversion oracle retained.
- Full Screen Library suite:437 tests passed after installing the existing locked isolated Worker dependencies and using its documented dependency link. New named capture scenarios for4,000, unavailable rate and invalid input are registered; updated catalogue/state/guard subset30 tests passed across all four locale manifests.
- All seven configured gates passed, including full ESLint and numeric lint/capture-rule tests. Targeted lint after final integration changes passed. TypeScript completed without diagnostics; final source check retained in publication receipts. All scoped files passed formatting and diff whitespace checks.
- Mutation evidence: restoring grouped parsing broke the4,000 real-slider test; removing the precision protection broke overprecision cases; restoring the legacy badge formatter broke Infinity display in all four locales. Original checkout was not mutated for these challenges.
- No full-repository Jest, native/device run, live payment, deployed verification, production impact count or live alert configuration is claimed. Browser inspection timed out. Hosted screenshots for registered new scenarios and required hosted CI remain review/merge evidence.
- No new Git hook is installed. Configured checks were invoked directly; local Git hook directory contains samples only. The new numeric checks are also wired into the existing required test workflow. A published PR does not merge or deploy the change.

Publication preflight caught a stale trusted capture-catalogue snapshot after the three new scenarios were registered. Regenerated only its18 new metadata lines from the actual catalogue; the complete437-test Screen Library suite then passed on the final snapshot (17.8s). No test expectation or capture gate was weakened.

The existing tool-level commit guard was observed active: it rejected a compound commit command and accepted the supported direct Git command after checks. No hook was installed or disabled; local Git hook files remain samples. Publication uses the authorized branch push and a ready-for-review PR, with merge/deployment left to maintainers.
