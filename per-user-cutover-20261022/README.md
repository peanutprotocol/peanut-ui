# Per-user card funding transition

UI source: 9c0f12134d7998c1e0dc11fcbd1d891ce56c548b. Captures: 375×667 CSS pixels.

The funding-return, funding-migration and holder-collateral images are full-app preview fixtures from a private production build. The18 card-public browser checks passed.

Files prefixed synthetic-component render the actual signed FundingSetupPrompt and shared controls with synthetic hook state. The real build CSS and fonts are used. Seven component visual checks passed, with no external network access. The clip shows ready, moving, failed, pending, retry and closed states. Its background contains only this component.

Neither capture set proves API, provider, chain, native signing or migration behavior. Existing screenshots are retained in earlier directories. This assets branch is removed after the PR is merged.
