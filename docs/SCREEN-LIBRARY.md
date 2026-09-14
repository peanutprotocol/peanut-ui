# Versioned screen library

The library combines two complementary sources. The app-state catalogue captures
deterministic synthetic states at 393×852 in every supported locale. Nutcracker
adds English screenshots from real Peanut backend journeys, provider sandboxes,
Arbitrum Sepolia and an isolated Postgres database. Synthetic captures remain the
complete visual baseline; Nutcracker supplies integration evidence for the subset
of states reachable through real journeys. Native system dialogs remain outside
the library.

Gallery filters are URL-backed. Source, locale, search, flow, status, and
all/changed mode are restored from the query string, so copying the browser URL
shares the exact visible view.

Only Nutcracker PNGs and a small allowlisted manifest are published. Replay
credentials, database snapshots, API traces, console output and provider details
stay in the private GitHub Actions artifact and never enter R2.

## Capture and compare

Use Node 22, pnpm 10.30.1, an initialized content submodule, and the browser
installed by this checkout's pinned Playwright. Each target is a separate
checkout at an immutable SHA. Never reuse a running development server.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --no-shell chromium
node scripts/screens/run-capture.mjs /absolute/path/to/before CHECKED_BEFORE_SHA /tmp/screens-before
node scripts/screens/run-capture.mjs /absolute/path/to/after CHECKED_AFTER_SHA /tmp/screens-after
node scripts/screens/report.mjs /tmp/screens-before /tmp/screens-after /tmp/screens-comparison
```

A failed capture command still writes `capture.json`, with failures attached to
specific states. The comparison command creates `manifest.json`, images,
`offline/index.html`, and `offline.tar.gz`. Open the offline HTML directly; it
needs no backend, login, or network. Reports preserve failed/unavailable states.
Those per-state gaps are publishable and do not fail the capture job; harness,
build, and runtime failures still fail the command.

The shared registry is `src/dev/screens/catalogue.ts`. It imports named API
fixtures, route checkpoints and surface metadata. Add stable IDs, concrete
synthetic data, and explicit interactions for new states. An exclusion needs a
reason. Never substitute a loading mascot, redirected page or harness placard
for the requested screen. Animated GIF/WebP assets are frozen at their first frame; tutorial videos use a paused 0.5-second checkpoint. Original PNGs drive pixel comparison; WebP thumbnails
are presentation only. Experimental design options are not product states.

Run `node --import tsx scripts/screens/inventory.ts` to audit app routes against
the catalogue, and `pnpm screens:test` for provenance/diff/adapter regressions.
Route inventory gaps prevent a run from being marked complete. The published
ledger identifies app routes with scenarios and explicit website/provider/tool
exclusions. It cannot discover every hidden state inside a route; review the
scenario ledger alongside route coverage when adding features.

## Historical reconstruction

The requested cutoff is August 27, 2026 at 23:59:59 Europe/Lisbon. The verified
first-parent main commit is `a10ec5be6b5ca1ed9157b34befad2833fba37ab7`; the initial
dev target is `85f95e42fc25e09f1df6724b8dfb4b8afbfb6a00`.

`prepare.mjs` overlays API and synthetic wallet/websocket transport guards plus a build-only cache switch
in the isolated target, analogous to modern fixture mode. It records original
and patched file hashes in `.screen-capture-adapter.json`. It never copies
components, CSS, translations or layouts from a newer revision. The runner requires a free port and waits for its own server to report ready;
a build nonce also identifies the requested build. Both revisions compile links
and QR codes against the same synthetic public base URL, independent of their
local capture ports. The browser also sees the canonical staging origin, with
all app requests fulfilled from the isolated local build; location.origin links
and QR payloads therefore cannot introduce port-number differences. Random
choices use a fixed draw independent of unrelated startup call order. Capture builds disable the disposable webpack cache.

Historical component-only states are reported unavailable when the old revision
has no isolated component harness. Unknown endpoint responses fail closed.
These are reconstructions of source code with synthetic data, not screenshots
of historical production sessions. Do not mark unavailable historical states as
new screens. Build each revision with its own lockfile and content commit.

## Private deployment

The gallery deploys independently to Cloudflare Workers from the trusted
publisher workflow after a successful dev publication. This ordering completes
any historical private-asset migration before new viewer or Worker code can go
live. No Next.js build or Vercel deployment is involved. Worker Static Assets
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
     R2 bucket. Until the first private publication has migrated every retained
     report, also keep Images Edit on this token so it can remove the old public
     Hosted Images objects. Save it as the repository
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

Before publishing a new report, the trusted publisher scans retained manifests
for legacy Cloudflare Images URL maps. It verifies each report against its
trusted offline archive, restores every content-addressed image to private R2,
deletes the corresponding public Hosted Images objects, and only then rewrites
the manifest without those URLs. A failed deletion leaves the old manifest in
place so the next run can retry; publication fails instead of declaring the
migration complete. After one successful run reports that all retained reports
were migrated, Images Edit can be removed from the publisher token.

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

## CI activation and provenance

`Screen library` builds the changed side without write credentials on PR
updates. The trusted publisher resolves the exact merge-base capture from a
successful dev integration run or the main-update baseline workflow; it
rejects stale, unrelated, or mismatched-harness baselines. Pushes and the
historical dispatch retain same-run two-sided captures. When a PR changes the
capture harness, fixtures, catalogue, or lockfile, the caller recaptures the
base with that PR harness instead of reusing an incompatible baseline. Full
catalogues run even for shared-style changes.

`Screen library baseline` refreshes the dev baseline after a main-branch update.
Its artifact is retained for seven days and is accepted only when the
artifact is unexpired and its run, branch, SHA, workflow, and capture manifest
all match the verified baseline. GitHub artifact expiration is the freshness
boundary; there is no shorter wall-clock cutoff during quiet periods. If the
baseline is unavailable or the capture harness changed, publication fails
closed instead of comparing against an arbitrary revision; run the baseline
workflow manually after enabling it.

`Publish screen library` is a reusable `workflow_call` job invoked after the
capture jobs finish. The caller resolves the reusable workflow from `dev`, and
the publisher checks out `dev`; PR checkout code never runs in that job. It
consumes the caller's exact after artifact and, for PRs, one separately
resolved baseline artifact. Same-run before/after artifacts remain the fallback
for integration and historical runs. It also runs after capture failures so
available evidence can be published with explicit gaps. Cancelled runs do not
publish. The baseline workflow must be registered on the repository's default
branch so its main-branch trigger can fire.

Merge publisher PR #3107 into dev first, then caller/catalogue PR #3108. Both
PRs target dev. Once storage is configured, that dev push captures and publishes
the merged library automatically, and subsequent same-repository PR reviews
publish their own comparisons through the same trusted reusable job. No change
to the repository default branch is needed. Historical manual dispatch retains
GitHub's normal workflow registration rules; automatic review and merge
publication does not depend on manual dispatch registration.

The existing ds-shots review aid remains available while the library rolls out.
Neither visual differences nor capture failures are part of required ci-success.

The publisher verifies run repository, event, head and baseline using GitHub and
Git history; superseded PR previews do not replace current links. It serializes
public index writes and uses triggering run order for the latest dev library.
Dispatch the historical workflow with dev selected; it uses the fixed cutoff above. Fork PRs do not
receive capture secrets and are skipped.

## Release acceptance

Before calling v1 complete: resolve every unexpected capture failure, reconcile
all app-owned routes and overlays, compare two independent captures of the same
build, inspect representative old/new screens, exercise a known pixel change,
and verify protected links with an allowed `@peanut.me` identity after a later
staging deployment. Also verify that signed-out and non-domain users cannot load
manifests or image assets directly.
Unvalidated or unavailable states remain visible; generating a manifest alone
is not completion. Languages, device sizes, text scaling and native/provider
capture tiers are v2.

CI report paths include `/run-<id>-<attempt>` so reruns never overwrite an earlier version.

The installation step uses a guest context inside the isolated harness. Account-ready
and notification-permission prompts expose their existing presentation as shared
views so capture does not require creating an account or contacting a push provider.
Historical isolated-component harness gaps remain explicitly unavailable.

Legacy routing aliases and native-only query-route stubs are excluded when their
canonical product UI is already captured. Retired promotional quest pages are
website content, outside this mobile-app catalogue. Historical notification and
settings routes remain in the registry so removal is proved from source.

The unused standalone `/add-money/us/bank` entry is excluded: no app navigation
links to it, and it depends on in-memory instructions from the former flow.
Current bank journeys use `/add-money/[country]/bank`. QR captures distinguish
permission denial from an unobstructed scanner using a stationary synthetic
camera frame; the capture runner never opens a real camera.

The publisher uses GitHub's `queue: max` so pending publications do not replace
one another (up to 100 queued runs; see [GitHub concurrency documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#example-queueing-multiple-pending-runs)).
When GitHub omits the event PR list, publication binds to the unique open
same-repository PR matching the run's branch and head. If no original base
snapshot is available, a changed merge base requires a rerun.

Support fallback captures replace only the provider iframe transport with a
synthetic `CRISP_FAILED` message, then assert the app-owned failure copy. The
third-party chat UI and its network readiness are not part of this visual tier.
Modal readiness waits for full opacity before transitions are disabled, since
browser visibility alone can accept a transparent entering panel.

Capture jobs use the fixed macOS 26 Intel runner family because the existing
tutorial assets contain HEVC with transparency. Linux Chromium cannot decode
them, and H.264 conversion loses their transparency. Original media stays
unchanged; the manifest records the actual OS and browser versions. Reference
resolution and trusted publishing remain on Linux. See [GitHub runner labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
