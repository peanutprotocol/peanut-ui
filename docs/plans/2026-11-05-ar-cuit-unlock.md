# Argentina CUIT unlock — 2026-11-05

## Acceptance and scope

User requested investigation, fix and published non-draft PR. No merge/deploy requested. Current main already has durable sessions, correction handling, bounded recovery and a dedicated advisory-lock pool.

- A1: Submitted SDK and tokenless pending-session reentry show a dismissible submitted/notification message without a spinner. Pending never means usable.
- A2: Rejected tax IDs retain explicit correction and SDK input validation; never retry rejected evidence automatically.
- A3: Repeated approved LATAM status POSTs read the current owned accepted pending session without provider calls, credentials, lock acquisition or provider-spend allowance. Explicit correction/new collection remains limited.
- A4: Alert on Manteca BANK_TRANSFER_AR continuously PENDING for over 10 minutes, even without a provider account. Durable deduplication per pending episode. User selected 10 minutes on 2026-11-05.
- A5: Only READY plus refreshed country-specific bank capability completes the UI; retain stale async/generation fences.

## What can go wrong

| Category | Trigger, invariant and test | Decision |
| --- | --- | --- |
| Invalid input | Invalid CUIT stays correction-required; malformed input never submitted by status reads. Existing checksum rules unchanged. | Requested |
| Concurrency | Repeated status calls do not lock provider work. Alert claim rechecks current episode. Stale UI reads ignored. | Required |
| Idempotency | Replay never rotates accepted action; one alert per episode across workers/restarts. | Required |
| Timeouts | Failed/hung reads remain unknown; waiting UI dismissible immediately. Alert independent of provider I/O. | Required |
| Retries | Read-only polling after submit; credentials/correction remain rate-limited. Failed alert DB work retries next cycle. | Required |
| Partial failure | Missing provider account still alerts. Failed notification enqueue must remain observable/recoverable. | Required |
| Auth | Current authenticated user, applicant and country required; ambiguous country cannot pick newest session. | Required |
| Data limits | Bounded deterministic alert batch; exclude alerted episodes before limit; IDs/durations only in telemetry. | Required |
| Migration | Preserve response shape for old clients; no schema change. Legacy rail with no events falls back to creation. | Required |

## Plan and verification

1. Isolate dirty product checkouts and inspect current main/NFR. API NFR missing: create scoped checklist.
2. Freeze spec tests with fresh gpt-6.1-sol test-only agent; parent implements. Shared filesystem is not enforced isolation.
3. Reproduce spinner/legacy rate-limit gaps, then implement submitted state, read-only legacy pending fast path and independent AR alert sweep.
4. Focused tests, changed-file lint/format, disposable failing variant and defect preflight. User preference excludes CI-equivalent local suites; keep commit guards and hosted protections.
5. Push scoped changes and publish linked ready-for-review PRs; inspect hosted checks and reviews.

## Migration and rollback

Additive UI phase/copy and JSON alert bookkeeping; no rail status change or migration. Preserve metadata on rollback. Maintainers own merge/deployment.

## Undecided and evidence boundary

Provider/live notification delivery and real device behavior require deployed validation. Incident counts/replay IDs are user-supplied, not independently replayed. No claim that all 17 rejected IDs were wrong. Tax fields are owned by Sumsub SDK; correction must preserve that contract.


## Implementation and review evidence

Added submitted notification copy and registered capture `24-c-kyctaxidsubmitted`; preserved SDK validation and display rejected-tax-ID guidance inside the correction form, with web fallback for native action corrections. Unrelated SDK openings clear correction state. Accepted legacy reads bypass provider-spend limiting only for exact authenticated user/current applicant/requested country; new credentials and corrections remain limited.

Review found notification loss after ACTIVE/READY races. AR enablement now commits a delivery-debt marker with the rail; an independent bounded, rotating sweep retries empty/failed dispatch results. Bank readiness has a separate localized notification key, not the identity approval message. Review also reproduced READY against an old/missing rail account ID; match the current account and reconcile legacy READY rows in a separate bounded pass without recollecting evidence.

Alert threshold is strictly over 10 minutes. Claims are persisted, expire after 60 seconds if unacknowledged, and exclude acknowledged episodes before the 100-row limit. SQL checks passed in disposable PostgreSQL; disabling deduplication in a disposable source copy caused five expected failures. Sentry enqueue is best effort: a crash after enqueue but before acknowledgement can cause a duplicate after lease expiry; an enqueue acknowledgement is not proof of provider delivery.

Tests use deterministic state matrices, faults, 8 concurrent callers/workers and a 101-row drain workload. No live load or CUIT fuzzing was run because provider policy/parser behavior is unchanged. Existing checksum behavior remains intact; rejected IDs still need exact provider evidence before changing validation policy. No hook was installed or reconfigured; configured guards and hosted branch protection remain in place.
