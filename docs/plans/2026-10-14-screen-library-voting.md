# Screen Library thumbs voting

The user requested thumbs up/down voting for every screen on 2026-10-14.
Extend the existing unmerged comments PR #3703 in its isolated worktree.
The client cannot switch to Plan mode; this persisted plan is its equivalent.
Read the product NFR and reuse the accepted identity, exact-version and rollout
contracts of screen comments. Screenshot versions have separate votes; only
signed-in humans vote; aggregate totals and the current user's choice are shown.
One user can choose up, down or neutral, switch sides, or click a selected side
again to remove their vote. Individual voters are not listed.

## Acceptance

- V1: Verified human Access identity owns at most one vote per screenshot scope.
  Only the server derives the actor; anonymous/spoofed/service users cannot vote.
- V2: A user can set +1/-1, switch, or remove (0); totals count current nonzero
  votes once. Show the user's pressed state and both totals on cards and previews.
- V3: Use the exact comments scope: report, screen, locale, viewport, image, side.
  Same pixels in different reports/locales/sides do not share votes. A first vote
  verifies the R2 manifest. Previously verified scopes remain valid when mutable
  collections advance, so historical votes remain readable/changeable/removable.
- V4: Persist votes in the existing D1 binding with an additive 0002 migration.
  Removal retains revision history (neutral row) to prevent ABA version races.
  Existing comments and R2-only/disabled packaging remain compatible.
- V5: Expected per-user version plus durable actor/request UUID enforces atomic
  CAS and replay. Concurrent same-version writes have one winner; stale requests
  return 409. Same UUID/payload replays; changed payload under the same UUID fails.
- V6: Bounded batch summaries (at most 100 scopes) return both totals and the
  authenticated user's choice/version in request order. Counts are unknown until
  verified, never zero on outages. No query per screenshot and no voter list.
- V7: Disable duplicate pending clicks; do not optimistically claim persistence.
  Lost-response retry reuses the same UUID/value/version. Explicit refresh
  reconciles uncertain writes. No automatic mutation retries. Delayed responses
  cannot overwrite a newer screen/identity or post another user's choice.
- V8: Full reload preserves totals/current vote; empty state starts at zero.
  Buttons use aria-pressed and accessible names, fit compact desktop/mobile UI,
  and work alongside comments, comparisons, filters and offline exports.

## Public API

Under `/screen-data/comments` and the existing verified identity/CSRF boundary:

- POST `/votes/summary`, JSON `{scopes:[scope...]}` -> 200
  `{votes:[{key,up,down,mine,version}...]}`. Max 100 scopes; order preserved,
  duplicates allowed; absent vote is mine=0, version=0, totals default zero.
- POST `/votes`, JSON `{scope,value,version,requestId,actorId?}` -> 200
  `{vote:{key,mine,version}}`. value is exactly numeric -1,0,1; version is a
  nonnegative safe integer; requestId UUID. First successful change is version1.
  Every accepted set (including same value/neutral) advances version by one.
  Summary refresh supplies authoritative totals after a confirmed mutation.
- Stable key is JSON.stringify([reportPath,screenId,locale,profile,image,side]).
  Trusted name/prNumber are ignored for identity. The public client includes its
  captured actorId as a mismatch guard, compared to the verified identity before
  replay. The server never derives ownership from this optional marker.
- Missing/unverified auth401, human-only403, missing/foreign Origin403,
  non-JSON415, malformed/invalid400, oversized32768-byte JSON413, stale/key
  conflict409, missing anchor404, unavailable provider/D1503. All responses
  no-store, errors sanitized; all failure paths must forbid partial writes.
- Previously verified scope metadata must be stored atomically with the first
  vote. Durable request receipts are actor-scoped, shared with comments using
  distinct fingerprints. A replay is checked before mutable anchor/revision reads.

## What can go wrong

| Category | Trigger and observable invariant | Verification / status |
| --- | --- | --- |
| Invalid input | Strings/booleans/null/arrays/NaN-like values, bad UUID/version/scope, big JSON must fail without writes | Frozen API positive/negative tests; technical defaults inherited |
| Concurrency | Two tabs/users, rapid clicks, remove/revote ABA: unique actor+scope and atomic expected revision prevent stale overwrite | Generic SQLite batch/CAS tests and browser pending/conflict flows |
| Idempotency | Double POST or timeout after commit: same actor/key/payload gives the same accepted state, conflicting payload409 | Durable replay and fault-after-commit tests |
| Timeouts | Access/JWKS/R2/D1/fetch: bounded inherited waits; outcome unknown, do not claim zero/saved | Fault fixtures and actual local Worker/D1 |
| Retries | Explicit retry retains exact request; refresh may reconcile then create a new intent at current version | Browser lost response / explicit refresh tests |
| Partial failure | Receipt/scope/vote interrupted: one D1 batch rolls back all writes | Inject each batch boundary, count forbidden effects |
| Auth | Forged author/email, expired/service identity, late 401 or account switch: backend ownership, no cross-user client choice | Inherited auth plus fresh vote/identity tests |
| Data limits | Many screenshots/actors: summary max100, indexed scope+value, one bounded query per batch, no voter list | Bounded100-scope/12-way tests; no live load test |
| Migration | Existing discussions, historical collection anchors, D1 disabled, old rollback artifact: additive schema only; retain rows | Migration replay, packaging, prior comments suite |

No business decision beyond the natural one-vote toggle and previously accepted
exact-version/teammate boundaries is required to implement this request. The user
can steer those stated defaults while reversible implementation proceeds.

## Implementation and verification

1. Fresh spec-only test author on a different model freezes API/browser tests
   before implementation. Roles/files separated by instructions; filesystem
   isolation is advisory and all agents share the worktree.
2. Implement server schema/routes and compact voting client; reuse auth, request
   bounds and existing atomic receipt mechanism where appropriate.
3. Run positive/negative/concurrency/fault and seeded operation tests, existing
   screen suite and required checks, actual local workerd/D1, browser recovery,
   and a deliberate failing protection in a disposable copy.
4. Apply only the additive migration to the dedicated empty EU D1 database when
   verified. Read back schema; no synthetic live votes/comments. Update existing
   draft PR, do not merge/deploy automatically. Preserve required independent
   workflow review and report unrelated hosted unit failures separately.

Assumptions: votes inherit signed-in teammate access and exact screenshot-version
scope from comments; retained votes have the same retention as screenshots.

Not handled: live activation remains subject to maintainer merge/deployment.

## Verification record

- Spec-only author: fresh gpt-6-luna; backend implementer: gpt-6.1-sol; UI:
  parent. Shared filesystem with advisory role separation, not process isolation.
- Frozen API tests first failed with 405 before vote routes existed. Subsequent
  independent review reproduced the /me-to-POST identity switch and unchanged
  revision refresh race; new frozen regressions preceded their fixes. Preview
  geometry regression reproduced feedback in the navigation column before CSS fix.
- V1–V8: 285 Screen Library Node tests passed, including 11 vote API and 5 backend
  cases; generic SQLite transactions test rollback at each of three batch boundaries,
  receipt replay, 12-way concurrent CAS, historical anchors and comments compatibility.
- Bounded breadth: seed 0x51c0ffee, 100 scopes × 12 actors = 1,200 writes with one-query
  summaries; parser seed 0x7007a11, 240 malformed inputs. Workload completes in the
  normal suite within 10 seconds locally. No live load/fuzz test was run because this
  is a small private review feature; synthetic bounded SQLite/workerd coverage applies.
- The disposable fixed-Alice writer variant failed actor-isolation acceptance as
  expected. Independent finder and verifier confirmed recovery/account regressions.
- Actual local workerd + D1/R2: 31 checks passed for signed JWTs, comments, votes,
  concurrent CAS, duplicate summaries, receipt replay and persistence after restart.
- Local voting browser and existing comments browser passed with synthetic identities,
  explicit retry/refresh, delayed server commit, account switch and 320–1024px widths.
  Screenshots contain a synthetic blank image, not a live product screenshot.
- Peanut EU D1: 0002_votes.sql applied and read back beside 0001_comments.sql;
  screen_vote_scopes/screen_votes exist, with zero votes and zero comment threads.
  No live Worker deployment or sample user data was created.
- First configured project-gate run passed all four commands (67 targeted screens,
  132 push-identity tests, full lint with 64 existing warnings, format), but correctly
  failed its stability check because the independent browser test changed during it.
  Freeze all source/test edits before the final supported gate/commit run.
- The prior hosted revision now has passing unit/type/lint/screens checks. Its
  publisher rejected zero app-screen differences: this change affects the gallery
  reviewer UI/API, verified with the dedicated browser flows. Use the documented PR
  exception reason, retain all capture/integrity checks, and do not retry the old run.
- Required workflow-independent review remains the merge boundary. No hooks were
  installed or modified; installed gates run on the supported runtime.
