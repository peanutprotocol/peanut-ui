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
- Verification: run focused acceptance and Jest regressions, the Screen Library suite, affected lint/format/type checks, and required hosted CI. Report local checks separately from native/device, hosted capture, and deployed behavior.
- Local hook: `.codex/quality-gates.json` runs a bounded Screen Library acceptance set plus affected ESLint and Prettier checks before direct commits. The full Screen Library suite and typecheck remain required in hosted CI; the local hook is an additional guardrail.

Undecided: whether future UI changes that do not alter pixels should use a standardized exception taxonomy; a free-text reason is accepted for this fix. Merge/release ownership and device release acceptance remain with the maintainers.
