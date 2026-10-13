# Peanut UI engineering checklist

- Visual coverage: every claimed UI state must have a deterministic, named capture scenario; capture completeness means all registered states ran, not that all changed states were registered.
- State truth: fixtures must preserve the relevant input and lifecycle state without real payments, applicant data, credentials, or external side effects.
- Review signal: a UI-changing PR with zero visual differences across all supported locales fails unless its PR description contains an explicit, nonempty Screen Library exception and reason.
- Provenance: gate only exact, current PR head/base revisions and validated capture reports; a stale or partial run cannot pass as zero difference.
- Reliability: retain immutable reports and source-verified publication; a gate failure must be visible after report creation and must not block index repair.
- Resources: avoid extra capture matrices and deployment runs for policy checks; use existing comparison manifests.
- Verification: run focused acceptance, Screen Library suite, affected lint/format/type checks, and required hosted CI. Report local checks separately from hosted capture and deployment.

Undecided: whether future UI changes that do not alter pixels should use a standardized exception taxonomy; a free-text reason is accepted for this fix.
