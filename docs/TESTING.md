# Testing

Full testing strategy (pyramid, CI/CD, post-release monitoring) lives in the monorepo:
**`mono/engineering/testing/strategy.md`**

## Quick commands (this repo)

```bash
npm test                              # Jest unit + component (710+ tests, ~25s)
npx playwright test --project=mobile  # E2E smoke (49 tests, ~8 min)
npx tsx e2e/scripts/generate-report.ts --save-baseline  # Visual regression baseline
npx tsx e2e/scripts/generate-report.ts                  # Compare against baseline
```
