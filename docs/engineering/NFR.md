# Peanut UI engineering checklist

- Money movement: preserve pre-sign affordability, execution idempotency and record-only recovery after funds move.
- Visual coverage: every claimed UI state must have a deterministic, named capture scenario; capture completeness means all registered states ran, not that all changed states were registered.
- State truth: validation for a new spend must not be shown as an error for an already processing or settled spend. Fixtures preserve the relevant input and lifecycle state without real payments or external side effects.
- Concurrency: late balance refreshes and route transitions must not enable duplicate confirmation.
- Auth/privacy: preserve existing identity scope and keep applicant, wallet and credential data out of fixtures and diagnostics.
- Compatibility: existing component callers retain defaults; these fixes require no backend or data migration.
- Review signal: a UI-changing PR with zero visual differences across all supported locales fails unless its PR description contains an explicit, nonempty Screen Library exception and reason.
- Provenance: gate only exact, current PR head/base revisions and validated capture reports; a stale or partial run cannot pass as zero difference.
- Reliability: retain immutable reports and source-verified publication; a gate failure must be visible after report creation and must not block index repair.
- Resources: avoid extra capture matrices and deployment runs for policy checks; use existing comparison manifests.
- Capture cost: classify known nonvisual diffs before capture dependency/browser installation. Unknown or unprovable impact requires full capture. A targeted PR runs every registered state in its affected flows across all four supported locales; dev/main after libraries remain full.
- Scoped coverage: targeted reports retain `complete: false` for the whole library and separately prove `scopeComplete`. The publisher recomputes the expected scope from immutable revisions. Omitted states are not tested, removed or unchanged; scoped reports cannot become full baselines or advance the full-library latest pointer.
- Baseline reuse: require a trusted exact-before source, retained full capture, valid image digests and compatible harness, fixtures, renderer, locale, viewport, adapter, origin and device. Missing, expired or incompatible evidence triggers at most one fresh-before capture per locale; API failures remain unknown and visible.
- Verification: run focused acceptance and Jest regressions, the Screen Library suite, affected lint/format/type checks, and required hosted CI. Report local checks separately from native/device, hosted capture, and deployed behavior.
- Local hook: `.codex/quality-gates.json` runs a bounded Screen Library acceptance set plus affected ESLint and Prettier checks before direct commits. The full Screen Library suite and typecheck remain required in hosted CI; the local hook is an additional guardrail.

Undecided: whether future UI changes that do not alter pixels should use a standardized exception taxonomy; a free-text reason is accepted for this fix. Merge/release ownership and device release acceptance remain with the maintainers.

## Push identity checklist

- Explicit logout detaches this device from the account; generic push remains enabled.
- Latest identity wins; duplicate requests must not create duplicate subscriptions.
- SDK failures are unknown and retryable; startup reconciles after auth resolution.
- Bound the push wait during logout; no unbounded retries or batch work.
- No account IDs, push tokens, or notification bodies in new telemetry.
- Web and Capacitor retain existing OneSignal interfaces; no schema change.
- Verify Jest notification/auth tests, lint, TypeScript, concurrency/fault cases.
- Local `.codex/quality-gates.json` runs the relevant auth/notification Jest suites and full ESLint alongside the upstream Screen Library and formatting checks within the existing dev 420-second budget. Full repository Jest/TypeScript and hosted branch protections remain the CI merge boundary; local focused checks are not a replacement.

Undecided: production rollout owner and provider-level suppression for account payloads already queued before logout. Device/provider delivery is separate evidence.

## Screen visual history checklist

- Read only immutable authorized report manifests; do not add publication, data
  mutation, capture, deployment or backfill work.
- Keep source, canonical branch or exact PR, locale and viewport independent.
  Stable screen IDs define identity; missing screenshots are gaps, not removals.
- Omit consecutive identical visuals; retain A-B-A and confirmed removal/restoration.
  Trust normalized noise only against the immediately observed comparison baseline.
- Reuse the 62px square date tile on the timeline line. Hide the current UTC year;
  show other years inside the square. Unknown dates must never become today's date.
- Bound reads to four concurrent manifests, 12 per page, eight seconds per read;
  expose remaining history and retry failures explicitly, without background loops.
- Cancel stale loads on close/change; retain successful reads and distinguish
  authentication, partial failure, unknown capture state and complete empty history.
- Preserve gallery/report/offline behavior, safe text and content-addressed assets.
  Verify frozen history tests, full screen suite, configured gates and responsive
  browser/fault cases. Hosted Access/deployment evidence remains separate.

Undecided: None for the approved app-state history integration. Historical gaps
cannot be reconstructed from reports that were never captured or retained.
