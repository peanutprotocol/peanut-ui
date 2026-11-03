# KYC release app phase 2

Preserve phase 1. Scope/order: C-F19, C-F16, C-F17, C-F20, C-F21 (typed echoes only), C-F22, C-F24, C-F14 (OTA collision only), C-F18 (fixture metadata/compatible surface; do not redo demo version), C-F15 (docs only). User request and verify-claude-codex-findings.md verdicts/fix assessments are authoritative. No API writes, commits, deployment, builds, full suites, Playwright, provider calls or env reads.

Plan mode is unavailable. This persisted plan is its equivalent.

## Acceptance

- CF19: send TEMPORARY_PROTECTION unchanged; backend owns VISA translation. Existing passport and phase-1 frozen-choice recovery remain valid.
- CF16: passive 401/404 and different-user login fence non-USER query caches; Profile details and paperwork caches belong to userId. Late reads cannot publish another user's KYC data. Temporary failures preserve same-user cache.
- CF17: capture authenticated token user at tap; after each permission wait and before save, account/unmount changes stop writes/navigation. Preferences PUT includes expectedUserId; API job supplies server enforcement.
- CF20: bind every answer PUT to expectedUserId; check token user before steps/retries and after awaits. Unmount/session change or terminal 409 stops remaining queued batches without deleting another account's draft or publishing stale UI. Existing same-user retries/double-click guards remain.
- CF21: mask typed free-text echoed pills, attributes and portaled typed-city suggestions through real replay/autocapture redactors. Fixed-option text retains existing policy (partial verdict).
- CF22: late and repeated returned rejection objects update errors/message, preserving edited values; same object does not resurrect cleared errors.
- CF24: bank caption derives usable held/openable corridor currencies, including GBP/COP, with residence refusals honored. Do not expand per-currency BANK_ROWS.
- CF14: exact branch digest distinguishes punctuation/case/truncated variants inside 60 characters; keep shared test signing design. Document existing test binaries need rebuild; no legacy dual-publish.
- CF18: one fixture report synthesizer receives restrictions/product refusals and normalized residence; QR paused rails carry explicit resolved restart verdict. Compatible dev surface derives REQUIRED_API_CONTRACTS. Preserve phase-1 demo version.
- CF15: docs describe dated owner-approved signup geo retention (source/time, analytics and users.geo); transient feature-surface use remains documented. No retention-code change or new compliance decision.

## What can go wrong

| Category | Trigger / invariant / impact | Verification / decision |
| --- | --- | --- |
| Invalid input | Semantic document types, missing/invalid identity, malformed returned metadata. Never translate TP prematurely or invent auth/eligibility. | Semantic TP and missing/mismatched identity negatives. Accepted by task/verdict. |
| Concurrency | A→B during cached read, permission wait, queued step/retry, or component unmount. | Deferred promises and rerenders; forbid stale data/write/navigation. Accepted. |
| Idempotency | Double tap, repeated rejection object, repeated pending saves. | Existing saving refs and same-object rejection tests; no repeated reset/write. Accepted. |
| Timeouts | Permission/network stall or lost save reply. Unknown remains retry/error; no stale continuation. | Deferred waits/unmount tests; preserve existing transport budgets. Accepted. |
| Retries | Account changes during 1s/3s waits or terminal conflict. | Fake timers; stop remaining queued batches and require deliberate recovery. Accepted. |
| Partial failure | Earlier step committed while later step fails/session changes. | Do not forget another user's draft; preserve edits and prior committed answers. Accepted. |
| Auth/privacy | Shared cookie changes account; typed input becomes visible button text. | Token-user fences + expectedUserId server contract; actual redactors. Server implementation belongs to API job. Accepted; exact 409 code asked asynchronously. |
| Data limits | OTA names collide at punctuation/case or truncation; captions duplicate currency. | Deterministic branch matrices, <=60 limit, deduplicated caption. No capacity path introduced. Accepted. |
| Migration | New OTA mapping disconnects old test binaries; old cache/test fixtures missing user IDs. | Rebuild note, updated scoped fixture keys, explicit resolved metadata. No schema migration; no production redeploy. Accepted. |

Failure list presented in commentary before implementation; outcomes derive from explicit task/review decisions. The app sends expectedUserId in the PUT bodies. No exact mismatch code was supplied; every protocol 409 terminates the current queued generation, including future/unknown codes. Server implementation is outside this worktree. No product policy was inferred from silence.

## Work and verification

1. Fresh spec-only test writers on different available model; shared filesystem provides context separation only. Read repro tests, extend existing normal test files, freeze expectations before production changes.
2. Per item in order: meaningful failing regression, fix, focused wrapper tests one file at a time with tail -n 80, record judgments.
3. Deterministic concurrency/fault tables and disposable guard-removal mutation for account write protection. No capacity load/random fuzz for finite UI/copy contracts.
4. Scoped lint/format, relevant defect-class preflight, then ui-typecheck.sh exactly once at end. Preserve phase-1 snapshot; final API re-sync is separate.
5. Write ~/.cache/kyc-fix/report-ui-phase2.md with item/command evidence, assumptions, not handled and product decisions. Leave changes uncommitted.

Rollback: reversible working-tree edits only, preserving phase-1 work. Required CI remains merge boundary; no hook installation/trust/activation changes.


## Observed verification

All 10 app items implemented; phase 1 preserved. Regression suites first reproduced the confirmed failures. The late initial-read extension additionally reproduced three obsolete Home redirects after unmount; a load generation fence now stops them. Final targeted verification: 50 files, 893 Jest tests plus the existing 10 Node adapter tests, all passing. The adapter Node suite runs inside a bounded Jest bridge under the required wrapper/lock. A disposable saveSteps variant with account checks removed failed by sending its second step as B; it was deleted without mutating production source.

The single ui-typecheck.sh run reported four diagnostics: a partial test capability object, nullable residence country, nullable compatible-surface version, and the new session_changed form-error mapping. All four source issues were corrected and affected suites re-passed. The typecheck was not rerun because the user permits one run. Final scoped Prettier and ESLint passed; ESLint retains two pre-existing warnings and ignores the adapter under its existing file configuration. No API edits, deployment, native/provider checks, commits or hook activation occurred. Report: ~/.cache/kyc-fix/report-ui-phase2.md.
