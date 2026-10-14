# Screen comments backed by D1

User authorized implementation on 2026-10-14 after reviewing the condensed
preview. Confirmed: any signed-in teammate resolves/reopens; only authors edit;
each screenshot version has a separate discussion. Keep the compact appearance.

Plan mode cannot be enabled by this client; this persisted plan is its equivalent.
Read project NFR and existing Worker/viewer/tests before implementation. Isolated
worktree `/private/tmp/peanut-screen-library-comments`, base `3765afe25` (`dev`).
No other product checkout is modified. Publish a PR; do not merge automatically.

## Acceptance

- A1: Authenticated human Access identities can create comments/replies and read
  their persisted discussion after reload. Authors come exclusively from verified
  identity. Service tokens and spoofed identity headers cannot act as people.
- A2: Only a comment's author edits it; any authenticated teammate resolves or
  reopens its thread. Resolved messages and replies remain readable and counted.
- A3: Anchors include verified report, screen, locale, viewport, exact image and
  before/after side. Same pixels in another report do not merge discussions.
- A4: Homepage latest-comments feed spans the library; PR feed is scoped to its
  PR. Clicking a feed entry opens its exact screenshot and thread. Image badges
  count all messages including replies and retained resolved messages.
- A5: Empty/oversize/malformed input is rejected; Unicode accepted; comment text
  is literal text. Missing/unavailable auth/storage is distinguishable from empty.
- A6: Mutations are durable and idempotent by actor/request UUID. Atomic operations
  prevent partial receipt/comment effects; stale edits/resolutions return 409.
- A7: Pagination is bounded and stable for equal timestamps. Every older thread,
  reply and feed message remains accessible through cursors and Load more.
- A8: Failed saves retain drafts and reuse request UUID for retries; explicit
  reload resolves uncertain outcomes. Late requests cannot overwrite a new screen
  or identity. No private comment cache survives an identity change.
- A9: Existing reports, offline exports, auth shell, comparison tools and capture
  publishing keep working. Missing D1 binding fails the comments feature closed.
- A10: D1 binding, additive migration, deployment packaging and configuration are
  reviewable and tested. Provision the dedicated database using existing account
  access when possible; activation follows verified exact artifact and budgets.

## What can go wrong

| Category | Trigger | Invariant / observable result | Verification |
| --- | --- | --- | --- |
| Invalid input | Malformed JSON, missing UUID, blank/4001 code points, bad anchor | 400/413, no persisted mutation; 4000 Unicode code points allowed | Positive/negative black-box API tests |
| Concurrency | Same version edited/resolved twice | One CAS winner, stale caller gets 409, no overwrite | Concurrent fixture requests, real SQLite constraints |
| Idempotency | Double click, retry after timeout | Actor-scoped UUID replay returns same resource; payload mismatch 409 | Duplicate concurrent/replay tests |
| Timeouts | JWKS/R2/D1/fetch delayed | Bounded boundary wait; unknown outcome never reported saved or empty | Fault injection; retry same UUID |
| Retries | Network/503 vs auth/validation/conflict | Explicit bounded user retry; no automatic new side effect ID | Client fetch fault tests |
| Partial failure | Constraint/batch failure or feed refresh after save | Atomic D1 transaction/receipt; drafts preserved until confirmed | Batch rollback fault; UI reconciliation |
| Auth | Expired token, bad signature/audience/issuer, service token, forged author | Fail closed before DB writes; author-only update server-enforced | Spec-only auth and ownership tests |
| Limits | Thousands of messages, equal timestamps, 100 screens | 30 feed/replies, 20 threads per page, max 100 counts/scopes; indexed ordered cursors | Cursor tie and bounded fixture workload |
| Migration | Existing captures/offline archives and missing binding | Additive schema; preserve screenshots and existing Worker read routes; no remote data deletion | Existing screen suite, config packaging and migration tests |

Technical defaults retain the preview's 4000-code-point plain text limit, bounded
pages, and indefinite retention consistent with retained reports. These are
engineering limits, not new product-policy decisions requiring another approval.

## Architecture and security

Private R2 retains screenshots. One D1 binding (`COMMENTS`) stores threads,
messages and actor-scoped idempotency receipts. Existing `/screen-data/*` Access
coverage includes `/screen-data/comments/*`. Verify human identities in the
Worker. Cloudflare documents that Static Assets routers do not propagate
`ctx.access`; support cryptographically verified Access JWTs using pinned team
issuer/audience and JWKS, rather than trusting the email header. Never log tokens
or comment bodies. Same-origin JSON writes reject cross-origin/absent Origin.

Creation verifies anchors from the authorized R2 manifest and derives screen
name/PR context from trusted manifest/path, never client-provided labels. Existing
threads retain their validated historical anchor even when a collection updates.
Edits/resolution use expected version plus transactionally persisted request
receipt. Never treat a zero-row conditional mutation as success.

## Verification and rollout

1. Fresh spec-only author, no inherited history, distinct model, freezes API
   behavioral tests before backend implementation. Filesystem separation is
   advisory, not enforced. Reuse existing preview behavior as UI acceptance.
2. Implement backend/schema and compact client, then run focused and full screen
   tests, lint, format, configured gates and relevant type checks.
3. Real local D1/Miniflare smoke when available; SQLite-backed adapter tests are
   labelled separately. Seeded boundary/concurrency/fault tests and deliberate
   broken protection in disposable copy; no live load tests.
4. Inspect existing Worker configuration, deployments/runs, health, and account
   before remote writes. Reuse existing R2 and Access, create only dedicated D1.
5. Deploy only necessary runtime change using exact verified artifact. Any paid
   deployment workflow gets 10-minute job / 5-minute deploy step budgets and
   sanitized phase progress. No bulk capture/reupload or duplicate deployment.
6. Read back binding/schema and authenticate browser smoke if access permits;
   report local, CI, D1, provider and live evidence separately. Draft PR when
   hosted validation incomplete. No automatic merge.

Rollback disables the comments binding/UI while retaining D1 data. Existing
gallery read routes continue to work; no data backfill is required. No hook code,
required protections or unrelated source/tests are weakened.

## Execution evidence

- Provisioned dedicated `peanut-screen-library-comments` database in Peanut's
  account with EU jurisdiction; applied `0001_comments.sql` using pinned Wrangler
  4.40.2. Remote readback confirmed the three discussion tables and zero messages
  or threads. No synthetic comments were written remotely.
- Verified team domain in the authenticated Cloudflare One dashboard:
  `empty-hall-158a.cloudflareaccess.com`. Reused the existing trusted repository
  Access audience. Configured the existing `screen-library-deploy` environment
  with the dedicated database, team issuer, existing EU R2 bucket and public URL.
- Full screen suite: 268 passed; configured identity suite: 132 passed in 23
  suites. Full lint: zero errors, 64 existing warnings. Explicit lint of public
  viewer/client with `--no-ignore` passed. Formatting passes after final edits.
- Actual local workerd/D1/R2 smoke: 22 checks passed, including signed JWTs,
  atomic receipt replay, author/teammate protections, the bounded screen query,
  retained resolved counts and persistence after Worker restart. Reproducible
  command is in the publisher guide. SQLite API tests remain separate evidence.
- Independent review found and drove fixes for late auth errors clearing a new
  identity, old drafts crossing account identity, late successful saves consuming
  newer drafts, and overlapping startup authentication leaving the feed blank.
  Browser verifier independently verified all four recovery paths; the complete browser flow, lost-response replay, 401 draft recovery and stale edit recovery pass.
- Disposable broken ownership, auth/config and build variants failed their
  relevant acceptance checks. Screen listing's 50-thread query budget regression
  reproduced 151 queries and passes with one query after the fix.
- App-wide `tsc --noEmit` failed in this isolated checkout on missing generated
  image declarations/content and absent app dependencies (`react-day-picker`,
  Capacitor filesystem/share). No application TypeScript files changed. This is
  not a passing full app typecheck; hosted CI remains required.

Assumptions: the existing Access application policy defines teammate membership;
retained reports and discussions have indefinite retention; workflow deployment
credentials need D1 Edit (live CI token scope cannot be read from GitHub).

Not handled: merge, live Worker activation and authenticated live comment writes
remain behind PR review/CI. The existing gallery was not redeployed. No hook code
or required branch protection was changed.
