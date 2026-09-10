# Trusted screen-library publisher bootstrap

GitHub loads `workflow_run` publishers from the default branch. This bootstrap
places the trusted publisher on main; the capture catalogue and staging viewer
routing are delivered separately on dev.

The capture job receives no Blob write token. This publisher downloads only the
triggering run attempt, verifies its repository, event and exact Git revisions,
validates the manifests and image hashes, recomputes differences, then publishes
immutable objects. It generates offline HTML from this trusted checkout and never
executes downloaded scripts or HTML. Public index updates are serialized.

Before activation, configure a dedicated public Vercel Blob store and the GitHub
Actions secret `SCREEN_LIBRARY_BLOB_TOKEN`. Configure `SCREEN_LIBRARY_STORE_URL`
on staging and deploy the dev viewer routing. Do not use a NEXT_PUBLIC variable
for the write token. Landing this bootstrap alone does not create a live gallery.

Validate the publisher with Node 20 and its pinned dependencies:

```sh
node --test scripts/screens/core.test.mjs scripts/screens/integration.test.mjs
```

The workflow installs pixelmatch 7.2.0, pngjs 7.0.0, @vercel/blob 2.3.1 and sharp
0.34.5 in an isolated directory without package installation scripts. Capture
failures remain visible in reports; only a complete dev library advances latest.
