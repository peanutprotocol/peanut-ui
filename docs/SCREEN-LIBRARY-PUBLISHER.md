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
downloads only the caller's current run attempt, checks the capture workflow path,
repository, event and exact revisions, validates images, recomputes differences,
and publishes immutable objects. It builds offline HTML from trusted viewer code;
it never executes downloaded scripts or HTML. Failed captures remain visible;
cancelled runs do not publish. Public index updates are queued and serialized.

Validate with Node 20 and the pinned publisher dependencies:

```sh
node --test scripts/screens/core.test.mjs scripts/screens/integration.test.mjs scripts/screens/review-provenance.test.mjs scripts/screens/run-identity.test.mjs scripts/screens/cloudflare-storage.test.mjs
```

The publisher installs pixelmatch 7.2.0, pngjs 7.0.0, @aws-sdk/client-s3 3.883.0 and sharp
0.34.5 without app install scripts. Only complete dev libraries advance latest.
The publisher queues up to 100 pending runs with queue: max. Missing event PR
lists use a unique live repository/branch/head binding; a changed fallback merge
base requires a rerun.

## Public deployment

The gallery deploys independently to Cloudflare Workers using
`screen-library-deploy.yml` on pushes to dev affecting the viewer, Worker or
workflow. No Next.js build or Vercel deployment is involved. Worker Static Assets
serves the viewer; only `/screen-data/*` invokes the read-only R2 handler.
The R2 bucket can remain private. Only JSON manifests/indexes and offline archives
are publicly readable through the Worker; internal entries are not exposed.

Use Cloudflare Images for all screenshots, thumbnails and pixel-difference images.
R2 holds only JSON/indexes and offline archives, with no standalone PNG objects.
Pixel comparisons run on original local capture bytes before upload. Online
images (including zoom/overlay) use Images delivery, which may optimize formats;
offline archives retain the original capture files. No Vercel Blob store is needed.

DevOps setup:

1. Enable Cloudflare Images and create a public `screen-preview` variant
   (393×852, fit scale-down, no cropping; no signed URL requirement).
2. Create a dedicated private R2 bucket. Retain objects
   indefinitely; respect object Cache-Control (index/latest use 60 seconds).
3. In GitHub Actions repository secrets set `CLOUDFLARE_IMAGES_TOKEN`
   (Account → Cloudflare Images → Edit, scoped to the account),
   `SCREEN_LIBRARY_R2_ACCESS_KEY_ID` and `SCREEN_LIBRARY_R2_SECRET_ACCESS_KEY`
   (R2 Object Read & Write credentials scoped to this bucket).
4. In GitHub Actions repository variables set `CLOUDFLARE_ACCOUNT_ID`,
   `SCREEN_LIBRARY_R2_BUCKET`, `SCREEN_LIBRARY_PUBLIC_URL` (gallery HTTPS origin,
   e.g. `https://screens.peanut.me` or the Worker’s `workers.dev` origin),
   `SCREEN_LIBRARY_IMAGES_HASH` (Images delivery account hash, distinct from account ID),
   and `SCREEN_LIBRARY_IMAGES_VARIANT=screen-preview`.
5. Add GitHub secret `CLOUDFLARE_WORKERS_TOKEN` with Account → Workers Scripts → Edit
   and Account → Workers R2 Storage → Edit, scoped to this account. For the custom
   domain also grant Zone → Zone → Read and Zone → DNS → Edit scoped to peanut.me.
   The zone must be active in this Cloudflare account. The deployment creates
   Worker `peanut-screen-library` and its configured custom domain; no Vercel
   environment variables or redeployment are needed. A workers.dev address can
   be used first (initialize the account’s workers.dev subdomain in the dashboard).
6. Merge #3107, verify the Deploy screen gallery job succeeds and the public
   gallery loads, then merge #3108 to activate captures. An empty R2 bucket shows
   a report-unavailable message until the first publication. Verify a report URL
   without login after publication. Manual workflow dispatch retains GitHub’s
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
Images and archive are uploaded before the manifest commit marker. An incomplete
report can be browsed but cannot become `/screens/latest/`. Only full dev
libraries advance that pointer; PR preview completion cannot move it.


References: [Cloudflare Images](https://developers.cloudflare.com/images/storage/upload-images/methods/), [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
