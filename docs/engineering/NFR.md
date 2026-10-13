# Peanut UI engineering checklist

- Money movement: preserve pre-sign affordability, execution idempotency and record-only recovery after funds move.
- State truth: validation for a new spend must not be shown as an error for an already processing or settled spend.
- Concurrency: late balance refreshes and route transitions must not enable duplicate confirmation.
- Auth/privacy: preserve existing identity scope and keep applicant, wallet and credential data out of test fixtures and diagnostics.
- Compatibility: existing component callers retain defaults; no backend or data migration in this fix.
- Verification: Jest regressions, affected-file ESLint/Prettier, TypeScript, and required hosted CI. Distinguish source checks from native/device and deployed behavior.

Undecided: none for this fix. Merge/release ownership and device release acceptance remain with the maintainers. No hook installation or activation is performed.
