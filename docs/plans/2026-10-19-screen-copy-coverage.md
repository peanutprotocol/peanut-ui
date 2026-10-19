# Screen Library: copy coverage

The Release 165 review found ~26 changed app states missing from the Screen
Library. States are registered by hand, so a new drawer, modal or error that
nobody registered is invisible, and nothing failed when it was missing.

Tier: standard (internal tooling).

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

A new drawer or modal almost always brings new copy, so this is how it gets
detected. UI with no new copy (a skeleton, a restyle) is not covered here.

## What can go wrong

| # | Failure | Mark |
|---|---|---|
| 1 | Eager `t()` calls (error maps, `t.has`) count unseen copy as shown | handle: text must be on the page |
| 2 | Placeholder-only messages (`{amount}`) cannot be verified | handle: resolved counts as shown, reported separately |
| 3 | CSS `text-transform`, NBSP, line breaks differ from the template | handle: case/whitespace-insensitive match |
| 4 | Proxy returns a new object per render and loops React | handle: one proxy per catalogue object (WeakMap) |
| 5 | `IntlCore` changes shape and the patch anchor disappears | handle: capture records `copyRecording: unavailable`; the gate fails closed |
| 6 | Open PRs captured by an older harness have no copy data | handle: gate skips only while neither base nor head has the recorder |
| 7 | Targeted PR capture cannot see out-of-scope states | handle: targeted rule compares the same states before/after only |
| 8 | Key shown only in a non-English locale change | handle: per-locale changed keys checked in that locale's report |
| 9 | Baseline grows silently | handle: growth needs the copy exception line |
| 10 | Stale baseline entries hide a later regression | handle: stale entries fail with the exact keys to delete |
| 11 | Flaky state shows a key intermittently | defer: surfaces as a baseline diff; fix the state |
| 12 | New UI with no new copy | out of scope here |
