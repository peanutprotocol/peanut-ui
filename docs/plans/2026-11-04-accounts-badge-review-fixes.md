# Bank account badge review corrections

Accepted contract: actionable fixable-rejection takes precedence over an endorsement-pending claim, so the row says Action needed and opens the existing actionable destination. Nonactionable review states retain Under review. Existing identity-required/restart, support and account-limit precedence stays intact.

## What can go wrong

- Conflicting provider facts can label an actionable destination as waiting: frozen acceptance checks actual badge and actual depositGateView.
- Missing trusted capture metadata breaks capture cost validation: regenerate only the added provider-asks fixture and verify every old id/value survives.
- Unknown or absent claims, unsupported corridors and nonactionable pending/ready review controls must preserve existing behavior; the original focused suite and independent controls cover these.
- No new async operation, write, parser, retry, auth, migration or bulk-data contract is introduced. Synthetic fixtures avoid provider actions.

## Plan and acceptance evidence

1. Freeze accepted positive/negative badge contract before implementation.
2. Fresh spec-only author requested as gpt-6-astra; inherited implementation model identity is unavailable, so actual model difference is unverified. Shared filesystem is not isolation. Four frozen tests use an adapter rendering real AccountsHubList and the actual depositGateView destination.
3. Meaningful baseline: one failed conflicting-state assertion and three passing controls. Corrected selection: 76 tests passed; affected lint and exact catalogue invariant passed.
4. Run required local guards, sign and push only to existing innolope/accounts-badge-action-needed PR branch, then inspect current-head hosted review/checks. No merge or deployment.

The common notification test-fixture correction moves fresh paired React/RTL/hook module loading to beforeEach, retaining resetModules, all behavioral assertions and five-second test deadlines. It corrects dependency setup consuming the behavioral test budget; no production notification change. The focused notification selection passes; a disposable disabled-retry mutant fails the original initialized-state recovery assertion.

Desktop Node26.7.0 is unsupported by this project. The machine-local unstaged gate config invokes installed Node22.23.2 through the existing low-priority heavy-job wrapper, emitting its runtime receipt. All existing checks and 420-second total budget stay unchanged. This does not change portable repository/CI policy.

## Assumptions

Existing actionable gate/destination precedence is the product truth accepted in review.

## Not handled

No live device/provider validation, merge or deployment. Full mirrored suites run in CI; configured local guards remain mandatory.
