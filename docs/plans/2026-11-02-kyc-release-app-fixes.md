# KYC release app fixes

Scope: F12, F13, F14, F15, F51 (two new app duplicates only), F54–F67, F70, X2, X5, X6, in requested order. Authoritative decisions: user request, common-rules.md and verdict/fix assessments in review-out/r3. Do not touch API/verify worktrees, deploy, commit, fetch specs, or call providers.

Plan mode is unavailable in this client. This file is the equivalent implementation/verification plan.

## Acceptance criteria

- F12: residence copy only for residence refusal; identity, support, restart and other refusals each expose their own remedy/copy, never amount entry.
- F13: use entryChip; retain /card unless notAvailable; support attention opens support; closed card copy belongs to its refusal (geo-blocked retains residence sentence).
- F14: second start errors never report success; explicit completed/not-required outcomes do; preserve quiet wait fallback.
- F15: only HTTP 404 funding-access absence selects legacy, never 409/503/network failures.
- F51: remove only card.funding.body and home.fundingSetup.descriptionReturn identical es-AR overrides.
- F54: existing_verification token conflict hands back Home and closes a stale SDK session.
- F55: page CTA icon matches intent; slow processing has one support control.
- F56: numbered pinned FAQ IDs retain links alongside future IDs.
- F57: pending card application without provider ID polls overview while mounted; stop on resolution/unmount.
- F58: limits attention text uses readable foreground; fill remains yellow.
- F59: submitted review waits for APPROVED, including REVERIFYING at open; ordinary REVERIFYING retains existing access behavior.
- F60: preserve coded 4xx; frozen replacement choice explains continuation and preselects API document; no automatic extra reset.
- F61/X5: es-419 uses tú; preserve former voseo as es-AR overrides; glossary catches these verbs.
- F62: no answer-revealing FATCA codes or events in identified analytics; UI refusal unchanged.
- F63: empty state shows required after blur; stored invalid choice shows error immediately; invalid values cannot submit.
- F64/X6: consistent translated SSN and article O/La Peanut Card.
- F65: QR restart reads own Manteca reasons; shared action only contributes provider-less identity causes.
- F66: support-linked accounts contain/render relation only.
- F67: synthetic demo version satisfies bundled REQUIRED_API_CONTRACTS.
- F70: copy pinned local API snapshot and run repo generator; no live fetch.
- X2: all name fields locked; PROFILE_NAME_READ_ONLY localized in all resolved app locales.

## What can go wrong

| Category | Trigger / invariant / impact | Test and decision status |
| --- | --- | --- |
| Invalid input | Refusal reason/action mismatch; empty/invalid state; coded 4xx lacking userMessage. Never invent residence or silently claim success. | Table-driven refusal/error tests, state blur tests. Accepted by task/review. |
| Concurrency | Pending overview/identity decisions arrive later; unmounted polling must stop. | Fake-timer transitions and cleanup. Accepted; no new cross-account work beyond scope. |
| Idempotency | Retry taps or frozen document mismatch must not trigger automatic extra identity reset or application POST. | Assert selected choice and forbidden side effects; retain existing guards. Accepted. |
| Timeouts | Funding-access/network/start action fails; unknown is error, never legacy or success. | 404 vs 409/503/network cases. Accepted. |
| Retries | Pending reads must recur; transient errors stay recoverable without unbounded writes. | Poll only reads at existing bounded interval; quiet wait preserved. Accepted. |
| Partial failure | First supplement completed, second request fails; frozen choice already committed. | Second-error tests and frozen-choice recovery. Accepted. |
| Auth | Sumsub owns all profile names; support payload must not expose internal identifiers. | All-user lock and relation-only fixtures. Server enforcement is API job. Accepted. |
| Data limits | Catalog layering and finite refusal branches; avoid box-wide suites and heavy concurrent tests. | Focused files through shared-flock wrappers only. No new large-data paths. Accepted. |
| Migrations | Installed UI on old API; local snapshot drift; inherited es-AR values. | Narrow 404 fallback, pinned snapshot sync, locale fallback tests. No schema migration. Accepted. |

Failure list presented in commentary for user edits before implementation; all listed outcomes derive from already explicit task/review decisions. Unknown product decisions are recorded, not inferred from silence.

## Milestones and verification

1. Fresh spec-only test authors (different available model from implementer), existing test conventions; tests precede production edits. Shared filesystem means context separation only.
2. For each requested item: read verdict/repro, extend normal tests, run one file at a time with ui-unit.sh and tail -n 80; record failing baseline and passing correction.
3. Run every affected module test file, plus scoped lint/format where available. No builds, full suites, Playwright or install.
4. Regenerate only from pinned local API snapshot with pnpm gen:api. Run ui-typecheck.sh once at end and resolve reports without rerunning heavy wrapper.
5. Reconcile evidence and judgments in ~/.cache/kyc-fix/report-ui.md; leave uncommitted.

Rollback: reversible working-tree edits; preserve user changes. No deployment or migration. Broader fuzz/load is not applicable to finite UI/copy contracts; table-driven tests and deterministic polling/fault injection cover relevant breadth. Hosted/device/provider validation remains outside permitted local checks.


## Results and judgment calls

- F12: only local_residence_unsupported gets the AR/BR residence screen. residence_sanctioned and other non-actionable refusals use the localized refusal explanation/support screen, avoiding a claim about an AR/BR legal residence. Known refusal reasons use the existing reason catalog before the generic kycFeatureRefusalCopy fallback.
- F13: the report is authoritative over cached card overview state. Support attention opens support; other actionable chips retain /card. Closed geo-blocked keeps residence copy even when banking is also restricted.
- F14: quiet wait preserved. A second supplement_changed after completed counts as finished for the reviewed GREEN/mixed-version case; transient errors never do.
- F15: 404 fallback lives at the service boundary so both display and accept-time rereads recover; 409/503/network remain unknown.
- F51: only the two confirmed new identical app keys were removed; existing duplicate catalog entries remain outside scope.
- F54: added handed-back token handling including closing refresh sessions. Optional token unavailable hand-back behavior was not added.
- F55: page follows getCta icon and suppresses the duplicate slow-case support link; no broader page redesign.
- F56: retain numbered and future FAQ mappings without changing the content pin.
- F57: 30-second read-only polling while pending; no automatic POST/reset after a lease. User explicitly scoped the app fix to polling.
- F59: only APPROVED decides a submitted replacement; cold REVERIFYING continues to preserve existing access.
- F60: preserve frozen replacement choices and preselect the server document with aria-current/checkmark; require an explicit next tap, never another automatic reset. Preserve coded 4xx without userMessage; retain existing display-ready codeless-message handling for other prose responses.
- F61/X5: preserve all twelve existing voseo lines as es-AR overrides; widened glossary catches each verb.
- F62: remove both identified answer-specific events, normalize generic error codes, and introduce no anonymous count. Product may separately decide whether an unattributed server-side count is useful.
- F63: required State waits for blur; stored invalid nonempty values remain immediately invalid. Preserve other empty-field blur behavior.
- F64/X6: SSN terminology and O/La Peanut Card articles match each locale's existing voice.
- F65: provider-ID purposes are read only from Manteca rails; provider-less identity causes keep their existing shared-action priority.
- F66: print only relation codes, preserving the API privacy contract; no attempt to recover hidden account IDs.
- F67: import the static required-contract constants directly, avoiding a demo API/module cycle.
- F70: pinned committed local API snapshot b5ea9bc894486ae869f8945d8c1d1070c384090e verified byte-for-byte before copy. Snapshot SHA256 8ba3bfc28d3f892b5b662a24c7156e71b9b8c9e8e38077e30ce6bca6046d63db; generated SHA256 51da4a7b7143f03e126640afbd596a3b1ec744509e6c8db1f6609c1daa0da2a6 after two generations. check:api exits 1 because its git diff compares the intentionally changed generated file with HEAD; generation is deterministic. No commit performed to clear that check.
- X2: every name is Sumsub-owned regardless of verification/profileNameLocked. The update result preserves PROFILE_NAME_READ_ONLY and all four resolved locales translate it (es-AR inherits identical es-419 wording).

Fresh GPT-6.1-sol spec-only authors wrote tests; primary agent implemented. Shared filesystem means context isolation only. Corrected public-contract fixture adapters (access/undefined funding hook, documented yellow-fill threshold, catalog/modal assertions, consumed SDK refresh rejection, noncompeting QR purpose) with test author; no routing/write/privacy assertion was relaxed.

Verification: failing baseline regressions observed for each requested defect class; focused files pass, including all app catalog suites. Disposable F12 broad-residence mutation failed five refusal tests while the actual source remained untouched. Deterministic fake timers use 60-second pending budgets/15-second review polls; finite reason/status/HTTP/locale tables replace inappropriate capacity load or random fuzz tests for these UI contracts. Scoped Prettier/ESLint and git diff --check pass (ESLint retains six existing warnings). The required ui-typecheck.sh was run exactly once and passed. Builds, full-suite runs, Playwright, production/provider calls, CI, hook installation/activation and deployment were not run under the shared rules.

Detailed command/item evidence: ~/.cache/kyc-fix/report-ui.md. All changes remain uncommitted.

Final X5 inspection also covered beta.closed (Pedile → Pídele) and beta.leftStillBeta (Reinstalala → Reinstálala). Both already have es-AR voseo overrides. New tests failed first, then the copy changed; same existing keys, no type contract change.
