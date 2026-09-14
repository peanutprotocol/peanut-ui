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

Validate with Node 20 and the pinned publisher dependencies:

```sh
node --test scripts/screens/*.test.mjs
```

The publisher installs pixelmatch 7.2.0, pngjs 7.0.0, @aws-sdk/client-s3 3.883.0 and sharp
0.34.5 without app install scripts. Only complete dev libraries advance latest.
The publisher queues up to 100 pending runs with queue: max. Missing event PR
lists use a unique live repository/branch/head binding; a changed fallback merge
base requires a rerun.

## Private deployment

The gallery deploys independently to Cloudflare Workers using
`screen-library-deploy.yml` on pushes to dev affecting the viewer, Worker or
workflow. No Next.js build or Vercel deployment is involved. Worker Static Assets
serves the viewer; only `/screen-data/*` invokes the read-only R2 handler.
The R2 bucket remains private. Cloudflare Access protects `/screens/*` and
`/screen-data/*`; the public root is a sign-in shell that shows a blurred gallery
and sends users to Google authentication. The Access policy allows only verified
`@peanut.me` identities.

R2 holds screenshots, thumbnails, pixel-difference images, JSON/indexes and offline
archives. The Worker exposes only content-addressed PNG/WebP assets and known report
objects under the Access-protected `/screen-data/*` route. Pixel comparisons run on
the original local capture bytes before upload, and online zoom/overlay views retain
the original image resolution. No public Cloudflare Images or Vercel Blob store is needed.

DevOps setup:

1. Create a dedicated private R2 bucket. Retain objects
   indefinitely; respect object Cache-Control (index/latest use 60 seconds).
2. Create two Cloudflare API tokens with separate values:
   - a publisher token with Workers R2 Storage Edit scoped to this gallery's
     R2 bucket. Save it as the repository
     `CLOUDFLARE_API_TOKEN` secret. The reusable workflow keeps its historical
     `CLOUDFLARE_PUBLISH_TOKEN` input for compatibility while exposing the
     value to the publisher process as `CLOUDFLARE_API_TOKEN`; this token never
     receives Workers Scripts Edit.
   - a deployment token with Workers Scripts Edit scoped to this gallery's
     Worker. Save it as the `CLOUDFLARE_API_TOKEN` secret in the
     `screen-library-deploy` environment. For a custom domain it also needs
     Zone Read and DNS Edit, as described below. The deployment job exposes
     this separate value under the same `CLOUDFLARE_API_TOKEN` runtime name.
     The publisher verifies its token ID and derives the S3 secret from its
     SHA-256 hash at runtime; no separate R2 keys are stored.
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
   to the Worker origin.
6. Merge #3107, verify the Deploy screen gallery job succeeds and the private
   gallery loads, then merge #3108 to activate captures. An empty R2 bucket shows
   a friendly empty state until the first publication. Verify that the root shows
   the sign-in modal, Google rejects non-`@peanut.me` users, and authorized report
   and image URLs load after login. Manual workflow dispatch retains GitHub’s
   default-branch registration limitation; dev push deployment has no such dependency.

The existing Vercel app preview workflow remains independent. Neither the Blob
secret nor `SCREEN_LIBRARY_STORE_URL` is used by the gallery anymore.

Only the separate trusted publisher receives the write credentials. The
publisher accepts hashes and validated JSON/PNG/WebP; no downloaded code or
HTML is executed. It reconstructs the comparison itself and generates offline
HTML from its own trusted viewer. Artifacts expire after 14 days; published
objects have no automatic expiry. Assets are deduplicated by SHA-256.

```sh
node scripts/screens/publish.mjs /tmp/screens-comparison 2026-09-10/compare-main-2026-08-27/85f95e42fc25e09f1df6724b8dfb4b8afbfb6a00
```

The token must be supplied through the environment, never the command line.
Images and the archive are uploaded before the manifest commit marker. An incomplete
report can be browsed but cannot become `/screens/latest/`. Only full dev
libraries advance that pointer; PR preview completion cannot move it.


References: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [R2 bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/).
