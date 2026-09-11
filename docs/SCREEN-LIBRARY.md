# Versioned screen library

The library captures synthetic app states at English / 393×852. It is visual
coverage, not proof that payments or provider integrations work. Nutcracker
continues to provide that evidence. Native system dialogs are outside v1.

## Capture and compare

Use Node 20, pnpm 10.30.1, an initialized content submodule, and the browser
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

## Public deployment

The viewer is static under `public/screen-library`; `/screens/*` rewrites to it,
so app auth/provider initialization cannot interfere. It reads data through
`/screen-data/*`. Configure `SCREEN_LIBRARY_STORE_URL` on the staging Vercel
project to the HTTPS custom-domain origin of a dedicated public Cloudflare R2 bucket, then
redeploy staging to register the rewrite. Do not put any write token in a
`NEXT_PUBLIC_` variable or in the capture environment.

Use Cloudflare Images for all screenshots, thumbnails and pixel-difference images.
R2 holds only JSON/indexes and offline archives, with no standalone PNG objects.
Pixel comparisons run on original local capture bytes before upload. Online
images (including zoom/overlay) use Images delivery, which may optimize formats;
offline archives retain the original capture files. No Vercel Blob store is needed.

DevOps setup:

1. Enable Cloudflare Images and create a public `screen-preview` variant
   (393×852, fit scale-down, no cropping; no signed URL requirement).
2. Create a dedicated R2 bucket with a public custom domain. Retain objects
   indefinitely; respect object Cache-Control (index/latest use 60 seconds).
3. In GitHub Actions repository secrets set `CLOUDFLARE_IMAGES_TOKEN`
   (Account → Cloudflare Images → Edit, scoped to the account),
   `SCREEN_LIBRARY_R2_ACCESS_KEY_ID` and `SCREEN_LIBRARY_R2_SECRET_ACCESS_KEY`
   (R2 Object Read & Write credentials scoped to this bucket).
4. In GitHub Actions repository variables set `CLOUDFLARE_ACCOUNT_ID`,
   `SCREEN_LIBRARY_R2_BUCKET`, `SCREEN_LIBRARY_STORE_URL` (public R2 HTTPS origin),
   `SCREEN_LIBRARY_IMAGES_HASH` (Images delivery account hash, distinct from account ID),
   and `SCREEN_LIBRARY_IMAGES_VARIANT=screen-preview`.
5. Set the same `SCREEN_LIBRARY_STORE_URL` in Vercel's staging/Preview environment
   and redeploy. Keep the existing Vercel deployment token. The Blob secret is unused.

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

## CI activation and provenance

`Screen library` builds both sides without write credentials. PR previews use
the exact merge base and head; merge reports use the first parent, expanding to
the complete integrated patch sequence for rebase merges. Captures are not
reused from a best-effort cache. Full catalogues run even for shared-style changes.

`Publish screen library` is a reusable `workflow_call` job invoked after the
capture matrix finishes. The caller resolves the reusable workflow from `dev`,
and the publisher checks out `dev`; PR checkout code never runs in that job.
It consumes only the caller's exact run and attempt. It also runs after capture
failures so available evidence can be published with explicit gaps. Cancelled
runs do not publish. There is no default-branch activation requirement.

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
and verify public links without login after a later staging deployment.
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
