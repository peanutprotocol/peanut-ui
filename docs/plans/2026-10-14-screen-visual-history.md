# Screen visual history

## Accepted behavior and provenance

User requested a visual timeline for each screen with dates, omitting unchanged
captures. On 2026-10-14 the user required reusing the existing square date tiles
as the timeline markers, replacing the text dates and dots; a second date filter
was rejected. The user selected and approved `Inside tile`: show the year inside
the square only when it differs from the current year. The user then explicitly
requested integration.

This client cannot switch into Plan mode; this file is the equivalent plan.
Implementation starts from refreshed `origin/dev` at
`3765afe25` in `/private/tmp/peanut-screen-history`, branch
`innolope/screen-library-history`. Existing comments/filter worktrees and their
open PRs are independent and must not be modified. No deployment, provider
configuration, data write, migration, merge, or paid workflow dispatch is in scope.

## Acceptance criteria

- AC1: A published app-state screen exposes History from its card/enlarged view;
  opening it shows real captures for the same screen ID and context.
- AC2: Context is source + canonical branch (`main`/`dev`) or exact PR channel +
  locale + viewport. Pair same-branch comparison/library publications; never mix
  unrelated PRs, branches, locales, or viewports.
- AC3: Chronological visual versions omit consecutive identical asset identities
  and trusted below-threshold comparisons against the immediately observed
  baseline. Preserve A-B-A, removal/restoration, and multiple changes on a day.
- AC4: Display the first available captured state as the initial baseline. Missing
  or failed observations remain visible as gaps, never proof of removal. A PR's
  initial comparison baseline is labelled as such; later PR bases do not become
  intermediate PR versions.
- AC5: Each visual version has exactly one existing 62px square day/month tile
  centered on a horizontal line. Non-current years are a third line inside the
  square. No separate date filter or text-date/dot marker is added to history.
- AC6: Clicking a date/thumbnail shows that version with the preceding visual
  version; the first version remains inspectable without a fabricated predecessor.
  Retain existing single/side-by-side/overlay behavior where applicable.
- AC7: Dates come from capture provenance, with publication date explicitly
  labelled when capture time is absent. Invalid dates display unknown, never now.
  Equal times have deterministic ordering. Current year follows the viewer's UTC
  date conventions already used for capture dates.
- AC8: Open history loads at most 12 manifests per page with at most four requests
  in flight. Older pages remain explicitly loadable without a hidden total cap.
  Show scanned/total progress and distinguish more available from complete history.
- AC9: Index/manifest reads have an 8-second timeout. Cancel on close/change;
  stale results never replace the current screen. No automatic retries; explicit
  retry repeats failed reads while retaining successful immutable results.
- AC10: Partial failures produce visible gaps/retry state. Authentication failure
  retains the existing Access sign-in boundary. Report text is literal text and
  only allowlisted relative report paths/content-addressed image assets are used.
- AC11: Existing gallery controls, report URLs/hash navigation, collections,
  journey galleries and offline reports remain usable. Offline/journey-only
  history is unavailable with an honest explanation; no fabricated local history.
- AC12: Native buttons, accessible names/focus, responsive layout at 320, 390,
  768 and 1024 pixels, stable reload/back links, and meaningful loading/empty/error
  states. No account data or credentials in fixtures or diagnostics.

## What can go wrong

| Category | Trigger | Invariant / impact | Verification / decision |
| --- | --- | --- | --- |
| Invalid input | Bad IDs, report paths, asset keys, timestamps, oversized/unsupported manifests | Reject unsafe input; distinguish unknown date/state from empty history; literal text | Positive/negative acceptance fixtures; malformed-date and path cases |
| Concurrency | Open B while A loads, close during fetch, out-of-order responses | Abort old work and guard generation; B remains current | Deterministic delayed/fault browser tests |
| Idempotency | Duplicate entries/reruns/library+comparison pair, repeated button click | One observation per immutable snapshot; adjacent equality only, retain A-B-A | Frozen acceptance cases and repeat/open checks |
| Timeouts | Hanging index/manifest request | Abort within 8 seconds; show failure, retain other successes | Injected stalled read and cancellation |
| Retries | Storage fails once or auth expires | No background retry loop; retry failed reads explicitly; do not retry auth into empty state | Failure/recovery and request counters |
| Partial failure | Some manifests load, some fail, screen absent from catalogue | Show gaps and incomplete status; never call failure a removal or unchanged | Mixed-success fixtures and error UI |
| Auth | 401/403, redirected Access login, unsafe external links | Existing same-origin protected read endpoints and sign-in flow; no new writes | Direct loader/browser auth cases, worker regression suite |
| Data limits | Long catalogue, equal dates, many screenshots | 12 manifests/page, four in flight, explicit remaining count, all pages reachable; lazy images | Bounded synthetic workload, deterministic ordering, 25+ record paging |
| Migration | Old immutable manifests, unknown metadata, offline bundles, rollback | Read existing reports; no backfill or data/schema mutation; offline/gallery behavior preserved | Legacy fixtures, existing screen/bundle tests; disable by reverting viewer |

The user has already accepted the visual behavior. Engineering mechanics above
preserve existing provenance and Access contracts. No new business-policy
decision or blanket approval is required; the failure list was presented for
edits before production implementation. Any genuinely unresolved decision found
during testing must be recorded rather than silently frozen as an assertion.

## Architecture and milestones

1. A fresh spec-only `gpt-6-astra` agent writes black-box tests against the public
   history contracts below, with no inherited context or implementation access.
2. Freeze tests and establish meaningful red failures on the baseline.
3. A separate `gpt-6.1-sol` implementation agent integrates the history model,
   bounded loader and UI in the existing vanilla viewer. Reuse existing assets,
   date styles and preview behavior; no new runtime package or storage endpoint.
4. Root performs finding discovery; a separate fresh verifier checks any
   substantive claim. Challenge adjacent deduplication in a disposable copy.
5. Run acceptance tests, complete Screen Library tests, configured product gate,
   formatter, affected lint, and typecheck. Browser-check real viewer fixtures and
   resource/fault behavior; distinguish these from live authenticated hosting.
6. Commit/push a reviewable PR against dev, assign `innolope-dev`, attach it to this
   chat, inspect CI. Draft if required validation remains incomplete. Do not merge
   or deploy.

## Public black-box contracts

Named functions in the classic `viewer.js` script, callable via a VM harness:

- `screenHistoryScope(entry, report)` -> `{ source, channel, locale, profile }`
  or `null` for unsupported contexts. Channels `dev`/`compare-dev` unify to dev,
  main equivalents unify to main; `pr-N` remains exact. Legacy `dev-SHA` maps dev.
- `screenHistoryEntries(index, scope)` -> validated matching entries, ordered
  newest first by publication date, sequence, attempt, then path, with duplicate
  paths removed. Missing source/locale/profile default to synthetic/en/393x852.
- `screenHistoryDate(value, now)` -> `{ day, month, year }`; `year` is a string
  only for a non-current UTC year, otherwise empty string. Unknown input returns
  `{ day: '?', month: 'Unknown', year: '' }`. Accept valid ISO dates/timestamps,
  reject normalized impossible calendar dates. `now` is an injectable Date.
- `buildScreenHistory(records, { id, scope })` -> `{ versions, gaps }`, with
  versions oldest first. Each record is `{ entry, report }`; reports use existing
  schema 1 capture/comparison shapes. Version fields include `image` (or null for
  confirmed absence), `status`, `capturedAt`, `commit`, `reportPath`, `name`, and
  `timeKnown`. Gaps identify report path and reason. Apply AC2-4 and AC7 without
  mutating inputs. Comparison rows carry normalized change hints. Captures use
  allowlisted asset names and captured/absent/failure states.
- `loadScreenHistoryPage(entries, { offset = 0, load, signal, onProgress })` ->
  `{ records, failures, nextOffset, done }`. `load(path, { signal })` is injected
  and returns a manifest. No more than 12 entries or four concurrent loads per
  call. Failures identify `entry` and `error`; successful records remain available.
  Abort rejects with AbortError, no more work scheduled, no unhandled rejection.
  Per-read timeout is 8 seconds. Invalid paths never reach `load`.

UI integration may add thin adapters, but frozen assertions/expected behavior
cannot be weakened to match implementation. Node core tests use a minimal DOM/VM
harness; browser behavior is verified independently on the actual viewer.

## Isolation, methods, rollback and outstanding evidence

Agents share filesystem capabilities; spec-only context separation is enforced by
instructions and a dedicated packet, not an OS sandbox. Models are explicitly
chosen from available aliases and differ. No live load/fuzzing against production.
Use deterministic fixture sequences for property breadth, bounded loader workloads
and a disposable failing deduplication variant. Seed/workload/results are recorded
with verification evidence. No new hook installation or trust change is needed;
installed hook runtime evidence, manual gates and hosted CI remain distinct.

Rollback is a viewer code revert; stored reports and APIs remain unchanged.
Implementation and local verification are complete as recorded below. PR/CI and
authenticated hosted verification remain separate. No deployment is requested.

## Frozen test evidence

Spec-only gpt-6-astra authored 31 black-box tests without reading product source.
Baseline Node 22 syntax/startup succeeded; all 31 feature-contract checks are red
because the five history APIs do not exist yet. Assertion/fixture source was
formatted by its original author before copying unchanged into scripts/screens.
Frozen SHA256: 7df0230cf59378fe0a22bedaa5d4f7cc5762f0f0f7a6204520872994a3da62c4.
Seed 0x51a7e202: 80 sequences of 24 observations (1,920 generated observations).
Loader cases cover 29 reports across 12/12/5 pages, four in-flight requests,
virtual 8000ms timeout, partial retry, abort and unhandled-rejection detection.
UI accessibility/layout, index-read timeout/auth, stale-screen rendering and
hosted behavior require separate checks. A-gap-A collapse policy is intentionally
not asserted beyond the required visible gap. No production implementation was
present when tests were frozen.

## Implementation and verification evidence

The isolated branch was rebased onto dev `ea55df4d3` before final checks, retaining
the upstream targeted-capture labels and all existing quality gates. Production
changes are limited to the existing viewer HTML, CSS and JavaScript; there are no
new endpoints, runtime packages or stored-data changes. The shared date-tile
renderer serves the landing strip and timeline. History covers route and component
IDs, canonical branches/exact PRs, explicit older pages, visible gaps, fair failed
read retries, URL/back behavior and version comparisons.

- Node 22.23.2: `node --test scripts/screens/*.test.mjs` passed **300/300** after
  rebasing, including the frozen 31 acceptance checks and ten new regressions.
  Runtime was 9.96 seconds. Earlier runs using the macOS git shim were invalidated
  by xcrun cache permissions; final checks used bundled native Git on PATH.
- Independent verifier reran all five review counterexamples against final viewer
  SHA256 `d9fb60c752863d7cb385b609650b97765c1918b451abbfd3547fb15acb50c2ec`.
  Component access, conflicting metadata, paired tiny-noise publications, mixed
  malformed reports and later PR bases passed. Nine invalid paths called no
  reader. All 29 persistent failures received an explicit retry within 36 reads,
  with maximum concurrency four; recovery preserved successes. The actual Escape
  handler aborted and closed history with a focused slider.
- Disposable mutation: replacing adjacent visual deduplication with global asset
  deduplication failed both the A-B-A acceptance case and seeded property at trial
  zero. The normal source passed both again. No working source was mutated.
- Browser workload: local Chrome/Playwright, 29 matching manifests plus four
  foreign contexts, three screen IDs, synthetic 393x852 assets. All pages are
  reachable as 12/12/5; four requests maximum, no automatic retries. Assertions
  cover individual frame fit and document width at 320/390/768/1024, 62px date
  tiles and non-current year, comparison/overlay, hostile literal text, reload,
  back navigation, stale close/switch responses, real eight-second index timeout,
  explicit recovery, persistent failures and Access 403 return URL. Screenshot
  inspection found and corrected history-specific frame sizing without clipping.
- Offline compatibility is checked through the actual bundle builder and local
  file browser. Synthetic screenshot dimensions and test selectors were corrected
  rather than weakening the existing asset integrity validation.
- `tsc --noEmit` exited 2 with 216 diagnostics: 211 missing-module errors and five
  resulting type errors. This checkout lacks ignored `next-env.d.ts`, generated
  testimonials, `react-day-picker`, `@capacitor/filesystem` and `@capacitor/share`
  in the reused dependency installation. The changed viewer and MJS tests are
  outside this TypeScript include list. This is not a passing full typecheck;
  publish a draft pending verification in the normal dependency/build environment.

The configured 420-second product gate retains existing capture-cost, catalogue,
viewer, zero-difference, auth/notification Jest, full ESLint and formatting checks,
and adds history tests, explicit public-JS lint and syntax checks. No hook was
installed or trust/runtime settings changed. Manual gate execution does not prove
automatic hook activation or replace hosted required checks. Authenticated hosted
Access behavior and live capture retention have not been tested in this session.
No production load test was run: the change is a bounded read-only static viewer;
deterministic fault/concurrency and seeded sequence tests provide relevant breadth.
