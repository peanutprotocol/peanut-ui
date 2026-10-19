# Screen Library: copy coverage and marketing pages

The Release 165 review found ~26 changed app states and every marketing page
missing from the Screen Library. App states are registered by hand, so a state
nobody registered is invisible, and nothing failed when it was missing.
Marketing and content routes were excluded outright.

Tier: standard (internal tooling; the fixture agent writes code, so its trust
boundary is treated as full).

## What changes

1. **Shown-copy recording.** Capture builds wrap the app's message catalogue in
   a recording proxy (`prepare.mjs` patches `IntlCore`; the harness injects the
   recorder). A key counts as shown in a state only when it was resolved during
   that state and its literal text is present in the rendered page. Each
   captured state stores its shown keys.
2. **Never-shown list.** Every full English dev capture publishes
   `copy-coverage.json`: every app copy key, the states that show it, and the
   keys no state shows. The gallery has a Copy coverage page.
3. **PR copy check** (trusted publisher, next to the zero-difference gate):
   - copy added or changed in the PR must be shown by a captured state;
   - on full captures, every never-shown key must be in
     `scripts/screens/copy-coverage-baseline.json`;
   - the baseline only shrinks: entries that are now shown or deleted must be
     removed, and new entries need `Screen Library copy exception: <reason>` on
     its own line in the PR description;
   - on targeted captures, a key shown before but no longer shown in the same
     states fails.
4. **Fixture agent.** When the check fails, the PR comment carries the missing
   keys. A team member comments `/chip screens`; Chip writes the fixture and
   catalogue entries and pushes them as `chip-peanut-bot` with `Ordered-By` /
   `Order` trailers, so the existing provenance and approval gates apply.
5. **Marketing pages.** The harness reads `/sitemap.xml` from the local build
   and captures every page for the capture locale as one full-page screenshot
   cut into 393×852 slices, so diffing, WebP publishing and the gallery work
   unchanged. Marketing-only changes, which used to skip capture, now capture
   marketing pages only.

## What can go wrong

| # | Failure | Mark |
|---|---|---|
| 1 | Eager `t()` calls (error maps, `t.has`) count unseen copy as shown | handle: text must be on the page |
| 2 | Placeholder-only messages (`{amount}`) cannot be verified | handle: resolved counts as shown, reported separately |
| 3 | CSS `text-transform`, NBSP, line breaks differ from the template | handle: case/whitespace-insensitive match |
| 4 | Proxy returns a new object per render and loops React | handle: one proxy per catalogue object (WeakMap) |
| 5 | `IntlCore` changes shape and the patch anchor disappears | handle: capture records `copyRecording: unavailable`; the gate fails closed when the harness supports recording |
| 6 | Open PRs captured by an older harness have no copy data | handle: gate skips with a note only when the PR head predates the recorder |
| 7 | Targeted PR capture cannot see out-of-scope states | handle: targeted rule compares the same states before/after only |
| 8 | Key shown only in a non-English locale change | handle: per-locale changed keys checked in that locale's report |
| 9 | Baseline grows silently | handle: growth needs the copy exception line |
| 10 | Stale baseline entries hide a later regression | handle: stale entries fail with the exact keys to delete |
| 11 | Flaky state shows a key intermittently | defer: surfaces as a baseline diff; fix the state |
| 12 | Agent pushes to a fork or acts on an unauthorised order | handle: same-repo PRs only; orderer write access re-checked server side |
| 13 | Prompt injection through PR text | handle: the agent reads only the publisher's comment block and repo files, never PR body text |
| 14 | Agent commit lacks provenance and wedges the PR | handle: commits carry `Ordered-By`/`Order`; bot-approval gate requires the orderer's approval |
| 15 | Sitemap page calls an unmapped API | handle: same synthetic-response rule as app states; fails visibly |
| 16 | Very long pages (legal) explode slice count | handle: 24-slice cap, recorded in the state name |
| 17 | Page height changes shift every later slice | out of scope: true visual change, reported as changed |
| 18 | Sitemap unreachable or empty in a revision | handle: marketing pass fails the capture instead of reporting zero pages |
| 19 | Marketing pass blows the job timeout | handle: own phase with progress lines; job budget raised to 90 min |
| 20 | Shared components used by marketing change in a targeted PR | defer: marketing runs on full, marketing-only and dev/main captures |
</content>
</invoke>
