# Trusted screen-library publisher on dev

This reusable workflow is called by Screen library after its capture jobs finish.
The caller explicitly selects this workflow from dev, and publication checks out
dev. It does not depend on workflow_run or a workflow landing on main.

Merge #3107 into dev first, then #3108, which adds the caller and catalogue.
Once storage is configured, the dev push builds and publishes the merged library.
Subsequent same-repository PR captures also call this publisher after finishing.
The default branch stays unchanged. Manual historical dispatch is separate and
still follows GitHub's workflow registration requirements.

Capture jobs receive no storage write credentials. This job receives them separately,
downloads all capture attempts from the caller's run and selects one complete pair,
checks the capture workflow path,
repository, event and exact revisions, validates images, recomputes differences,
and publishes immutable objects. It builds offline HTML from trusted viewer code;
it never executes downloaded scripts or HTML. Failed captures remain visible;
cancelled runs do not publish. Public index updates are queued and serialized.

Validate with Node 22 or later and the pinned publisher/deployment dependencies:

```sh
node --test scripts/screens/*.test.mjs
```

The publisher installs pixelmatch 7.2.0, pngjs 7.0.0, @aws-sdk/client-s3 3.883.0, sharp
0.34.5 and TypeScript 5.9.3 without app install scripts. TypeScript parses source
dependencies as data; publication never executes PR product modules. Only
complete dev libraries advance latest.
Immutable uploads run concurrently across workflow runs. Only the short shared
index refresh queues with `queue: max`. Missing event PR lists use a unique live
repository/branch/head binding; a changed fallback merge base requires a rerun.

Targeted PR reports declare the captured screen IDs and separate scope coverage
from full-library completeness. The publisher recomputes the expected affected
flows from the bound before/after revisions and its trusted catalogue, requires
matching complete scopes in all four locales, and retains the zero-difference
exception check. An artifact's own scope declaration cannot authorize less
coverage. A full plan rejects a targeted report.

Reused before artifacts preserve their source manifests and carry source-run
provenance. Publication independently rechecks the source run, retained artifact,
exact previous commit, renderer compatibility and content-addressed assets.
Missing or incompatible captures cause one bounded fresh capture per locale;
unavailable API evidence cannot be treated as a verified baseline or successful
skip. Scoped PR reports cannot serve as full integration baselines.

## Private deployment

The gallery deploys independently to Cloudflare Workers through the trusted
reusable `screen-library-gallery.yml` workflow after a successful dev publication
and index refresh, or for gallery-only dev maintenance that skips app captures.
Both caller paths use the existing dev-pinned publisher without new inputs; the
trusted publisher derives maintenance from the exact push event. This keeps
pre-merge callers compatible and credentials on trusted code. Index-only
maintenance refreshes indexes without redeployment. Gallery
deployments are serialized and compare deployment inputs with current dev before
using their exact queued source: later docs-only commits are compatible, while a
newer gallery change prevents rollback. No
Next.js build or Vercel deployment is involved. Worker Static Assets
serves the viewer; `/screen-data/*` invokes the private R2 handler and the optional
comments API at `/screen-data/comments/*`.
The R2 bucket remains private. Cloudflare Access protects `/screens/*` and
`/screen-data/*`; the public root is a sign-in shell that shows a blurred gallery
and sends users to Google authentication. The Access policy allows only verified
`@peanut.me` identities.

R2 holds full-resolution WebP screenshots and pixel-difference images, JSON/indexes
and offline archives. New reports reference only content-addressed WebP assets and
known report objects under the Access-protected `/screen-data/*` route. Pixel
comparisons run on exact PNGs inside GitHub Actions before publication. The publisher
then creates one 393×852 lossy WebP per app-state image and uses that same asset for
cards, zoom and overlays; those WebPs are never used as future diff inputs. No public
Cloudflare Images or Vercel Blob store is needed.

DevOps setup:

1. Create a dedicated private R2 bucket. Retain objects
   indefinitely; respect object Cache-Control (index/latest use 60 seconds).
2. Create two Cloudflare API tokens with separate values:
   - a publisher token with Workers R2 Storage Edit scoped to this gallery's
     R2 bucket. Save it as the repository `CLOUDFLARE_API_TOKEN` secret. The
     reusable workflow keeps its historical
     `CLOUDFLARE_PUBLISH_TOKEN` input for compatibility while exposing the
     value to the publisher process as `CLOUDFLARE_API_TOKEN`; this token never
     receives Workers Scripts Edit.
   - a deployment token with Workers Scripts Edit scoped to this gallery's
     Worker. Save it as the `CLOUDFLARE_API_TOKEN` secret in the
     `screen-library-deploy` environment. For a custom domain it also needs
     Zone Read and DNS Edit, as described below. The deployment job exposes
     this separate value under the same `CLOUDFLARE_API_TOKEN` runtime name.
     The publisher accepts account-owned or user-owned API token values, verifies
     them at the matching Cloudflare endpoint, and derives the S3 secret from the
     SHA-256 hash at runtime; do not store an already-derived R2 Secret Access Key
     in `CLOUDFLARE_API_TOKEN`. No separate R2 keys are stored.
3. In GitHub Actions repository variables set `CLOUDFLARE_ACCOUNT_ID`,
   `SCREEN_LIBRARY_R2_BUCKET`, `SCREEN_LIBRARY_R2_JURISDICTION` (`eu` for screenshots-library),
   `SCREEN_LIBRARY_PUBLIC_URL` (gallery HTTPS origin,
   e.g. `https://screens.peanut.me` or the Worker’s `workers.dev` origin).
4. In Cloudflare Zero Trust, connect Google as an identity provider and create
   one self-hosted Access application with the Worker hostname plus both paths:
   `/screens/*` and `/screen-data/*`. Allow the `peanut.me` email domain, permit
   only the Google identity provider, and enable instant authentication. Keep the
   root URL outside Access so it can render the branded sign-in shell.
5. For a custom domain, the deployment token additionally needs Zone Read and
   DNS Edit scoped to the domain's zone, which must exist in this account. For
   workers.dev no zone permissions are needed. Initialize the account's
   workers.dev subdomain in the dashboard and set `SCREEN_LIBRARY_PUBLIC_URL`
   to the Worker origin. Generated deployments disable Preview URLs. A custom
   domain also disables the Worker's alternate workers.dev route; a workers.dev
   deployment retains only its configured production hostname.
6. Merge #3107, verify the Deploy screen gallery job succeeds and the private
   gallery loads, then merge #3108 to activate captures. An empty R2 bucket shows
   a friendly empty state until the first publication. Verify that the root shows
   the sign-in modal, Google rejects non-`@peanut.me` users, and authorized report
   and image URLs load after login. Manual workflow dispatch retains GitHub’s
   default-branch registration limitation; dev push deployment has no such dependency.

The existing Vercel app preview workflow remains independent. Neither the Blob
secret nor `SCREEN_LIBRARY_STORE_URL` is used by the gallery anymore.

## D1 screen comments and voting

The gallery uses one dedicated D1 database for comment threads, messages and
actor-scoped idempotency receipts. Screenshots remain in private R2. Discussions
belong to an exact report, screen, locale, viewport, image and before/after side;
new screenshot versions have separate discussions. Authors can edit their own
messages, and any signed-in teammate can resolve or reopen a thread. Resolved
messages and replies remain readable and included in image counts. The homepage
feed spans the library and a PR's feed includes only that PR.

Each screenshot also has compact thumbs up/down controls beside its comment count
and in the enlarged preview. A signed-in teammate has one vote per exact screenshot
version; choosing the selected thumb removes the vote, and the other thumb switches
it. Totals are shared while the selected state belongs only to the current user.
The additive `0002_votes.sql` migration uses the same `COMMENTS` database. Neutral
rows retain personal revisions to reject stale votes after removal. Durable request
receipts make an explicit retry safe after a lost response. Saving disables duplicate
actions and preserves confirmed totals until the server confirms a new summary.
Refresh reads the latest totals; an unavailable read displays an unknown count.

To enable comments, provision `peanut-screen-library-comments` in the existing
Cloudflare account, using EU jurisdiction to match the screenshot bucket. Record
its database UUID, then configure these GitHub Actions variables together in the
deployment environment or repository:

| Variable | Value |
| --- | --- |
| `SCREEN_LIBRARY_COMMENTS_DATABASE_NAME` | `peanut-screen-library-comments` |
| `SCREEN_LIBRARY_COMMENTS_DATABASE_ID` | The dedicated D1 database UUID |
| `SCREEN_LIBRARY_ACCESS_AUD` | The audience tag from the gallery's Access application |
| `SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN` | The configured Zero Trust team hostname, such as `peanut.cloudflareaccess.com`, without scheme or path |

Read the audience and team hostname from trusted Cloudflare settings. The Worker
pins both when validating signed Access JWTs; it does not trust the email header.
The Static Assets router does not propagate `ctx.access`, so JWT validation is
required on that production path. Keep `/screen-data/*` protected by the existing
Access application. The deployment token also needs D1 Edit in the same account;
the separate capture/publisher token does not gain comments database access.

The prepared Worker binds D1 as `COMMENTS` and includes the committed migration
directory plus the locked `jose` dependency. `prepare.mjs` rejects partial D1 or
auth configuration before writing the deployment artifact. Leaving both database
variables unset preserves the R2-only deployment and omits the comments and voting clients
from both gallery entry pages, so no comments sign-in prompt appears. Shared
Access variables alone do not enable comments. Install dependencies before
preparing or bundling:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix scripts/screens/deploy
node scripts/screens/worker/prepare.mjs /tmp/screen-gallery
scripts/screens/deploy/node_modules/.bin/wrangler d1 migrations apply COMMENTS --remote --config /tmp/screen-gallery/wrangler.json
scripts/screens/deploy/node_modules/.bin/wrangler deploy --config /tmp/screen-gallery/wrangler.json
```

Supply account credentials through the existing environment, never command-line
arguments. The workflow applies only pending additive migrations before deploying
the exact trusted revision. It does not recapture, backfill, delete or reupload
screenshots. A migration failure stops deployment; already applied additive
schema remains compatible with the previous gallery. Normal rollout has a
10-minute deployment-job budget, a 5-minute limit for each remote operation, a
270-second command deadline and sanitized progress every 45 seconds. No automatic
deployment retry is configured. Inspect active runs, the revision and recent
timings before dispatching another deployment.

After rollout, read back the `COMMENTS` binding and applied migrations, then verify
an authenticated comment, reply, author-only edit, teammate resolution and reload
persistence in the gallery. Also check voting, switching, removal, separate users,
and reload persistence. Local SQL/API tests, Worker bundling, hosted CI and
this authenticated live check are separate evidence. Offline exports retain their
existing viewer and do not contact the comments API.

For rollback, remove both database variables and redeploy the previous verified
gallery artifact. Retain the D1 database and migrations; do not drop tables or
delete discussions. Comment retention follows retained reports indefinitely.

Hosted Images is not part of the current storage path. Normal publication never
deletes retained objects or scans historical reports for migration work. The
publisher lists existing content-addressed R2 assets once per run, uploads only
missing hashes with bounded concurrency, shares duplicate conversions, commits
all report and entry objects, and refreshes the shared index once. The immutable
uploads do not hold the global index lock.

Only the separate trusted publisher receives the write credentials. The
publisher accepts hashes and validated JSON plus exact PNG capture inputs; no
downloaded code or HTML is executed. It reconstructs the comparison itself,
converts only the public copy to full-resolution WebP, and generates offline HTML
from its own trusted viewer. Artifacts expire after 14 days; published objects
have no automatic expiry. Assets are deduplicated by SHA-256.

```sh
node scripts/screens/publish.mjs /tmp/screens-comparison 2026-09-10/compare-main-2026-08-27/85f95e42fc25e09f1df6724b8dfb4b8afbfb6a00
```

The token must be supplied through the environment, never the command line.
Images and the archive are uploaded before the manifest commit marker. An incomplete
report can be browsed but cannot become `/screens/latest/`. Only full dev
libraries advance that pointer; PR preview completion cannot move it.

Main pushes also publish full `main/<locale>/<sha>/run-<id>-<attempt>` libraries
and `compare-main/<locale>/<sha>/run-<id>-<attempt>` comparisons. The trusted
publisher obtains the previous main SHA from the original push event, not from
capture artifacts. Main reports appear under the dashboard's **Branch → Main**
filter and do not move the dev latest pointer. See **Main release snapshots** in
`SCREEN-LIBRARY.md` for manual release backfills and activation requirements.
Dev pushes publish the matching `dev` and `compare-dev` pair with the same
original-push-boundary rule; feature PR previews continue to use `pr-<number>`.


References: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [R2 bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

Comments can also be verified entirely locally after preparing the Worker:

```sh
scripts/screens/deploy/node_modules/.bin/wrangler deploy --dry-run --config /tmp/screen-gallery/wrangler.json --outdir /tmp/screen-gallery/dist
node scripts/screens/comments-runtime.cjs /tmp/screen-gallery/dist/index.js
```

This smoke uses actual local workerd, D1 and R2 bindings with synthetic signed
identities, an outbound mock limited to the pinned JWKS URL, and a temporary
persistent database that is removed afterward. It does not contact live comments
storage. `node scripts/screens/comments-browser.mjs` independently exercises the
viewer against a localhost Worker/SQLite fixture; install Playwright and set
`PLAYWRIGHT_EXECUTABLE_PATH` when using an existing browser binary. The browser
check requires Node with `node:sqlite` (Node 22.13 or newer).
