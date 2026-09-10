# Trusted screen-library publisher on dev

This reusable workflow is called by Screen library after its capture jobs finish.
The caller explicitly selects this workflow from dev, and publication checks out
dev. It does not depend on workflow_run or a workflow landing on main.

Merge #3107 into dev first, then #3108, which adds the caller and catalogue.
Once storage is configured, the dev push builds and publishes the merged library.
Subsequent same-repository PR captures also call this publisher after finishing.
The default branch stays unchanged. Manual historical dispatch is separate and
still follows GitHub's workflow registration requirements.

Capture jobs receive no Blob write token. This job receives that token separately,
downloads only the caller's current run attempt, checks the capture workflow path,
repository, event and exact revisions, validates images, recomputes differences,
and publishes immutable objects. It builds offline HTML from trusted viewer code;
it never executes downloaded scripts or HTML. Failed captures remain visible;
cancelled runs do not publish. Public index updates are queued and serialized.

## Storage and deployment

Use a dedicated public Vercel Blob store for persistent PNGs, thumbnails and
manifests. Configure its write token as GitHub secret SCREEN_LIBRARY_BLOB_TOKEN.
Configure SCREEN_LIBRARY_STORE_URL on staging and deploy the viewer using the
existing Preview deploy workflow (VERCEL_TOKEN, squirrellabs/peanut-wallet).
The deployment token and the Blob write token serve different purposes; the
presence of VERCEL_TOKEN does not establish that Blob has been provisioned.
Never put a write token in a NEXT_PUBLIC variable.

Vercel Blob is the recommended storage backend already implemented here. Render
is also possible with a persistent disk attached to a service, plus upload and
serving endpoints; its default filesystem is ephemeral. No Render dependency is
needed for this gallery. Storage setup and public access verification are still
required before calling the rollout complete.

References: [Vercel Blob](https://vercel.com/docs/vercel-blob),
[Render persistent disks](https://render.com/docs/disks).

Validate with Node 20 and the pinned publisher dependencies:

```sh
node --test scripts/screens/core.test.mjs scripts/screens/integration.test.mjs scripts/screens/review-provenance.test.mjs scripts/screens/run-identity.test.mjs
```

The publisher installs pixelmatch 7.2.0, pngjs 7.0.0, @vercel/blob 2.3.1 and sharp
0.34.5 without app install scripts. Only complete dev libraries advance latest.
The publisher queues up to 100 pending runs with queue: max. Missing event PR
lists use a unique live repository/branch/head binding; a changed fallback merge
base requires a rerun.
