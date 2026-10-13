# UI incident preflight

## Balance validation after a withdrawal starts (2026-10-13)

- Trigger: live balance decreases while the crypto withdrawal review remains mounted during execution or payment recording. The obsolete affordability warning flashes before success.
- Evidence: PostHog confirmed -> settled -> completed sequence on Android release b105626; user explicitly requested removal of the false warning.
- Root cause: ConfirmWithdrawView rendered insufficientBalance without checking processing or executed-spend state.
- Search: `rg -n 'insufficientBalance|alreadySpent|isProcessing' src/features/withdraw/views/ConfirmWithdrawView.tsx`; inspect all component call sites when changing these states.
- Invariant: suppress balance warnings during processing and after this charge has spent. Preserve the pre-sign balance check and real operation errors. Disable Retry while processing, including record-only recovery.
- Counterexample: an idle charge that has not spent and cannot afford the amount must still show the warning and block confirmation.
- Regression: ConfirmWithdrawView.processing-balance.test.tsx exhausts the eight processing/spent/shortage states and exercises refresh, unsuccessful execution, recording recovery, duplicate clicks and Send framing.
