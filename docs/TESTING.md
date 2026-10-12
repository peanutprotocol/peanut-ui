# Testing

Full testing strategy (pyramid, CI/CD, post-release monitoring) lives in the monorepo:
**`mono/engineering/testing/strategy.md`**

## Quick commands (this repo)

```bash
npm test                                        # Jest unit + component (~30s)
NEXT_PUBLIC_VERCEL_ENV=preview npm run build    # both Playwright configs need this build
npm run test:e2e:regression                     # behaviour specs in e2e/flows (~1 min)
npm run test:visual:capture                     # one PNG per fixture per width
npm run test:visual:diff <before> <after>       # compare two capture directories
```

Browse the fixtures at `/dev/fixtures`, or open one with `<route>?__fixture=<name>`.

Anything that needs a real backend, provider or chain goes to the Nutcracker
harness in mono (`engineering/qa`), not to Playwright here.

## Manual visual checks for dev PRs

`ds-shots` does not run automatically on pushes to `dev` or PRs targeting `dev`.
Post an exact `/ds-shots` comment in the PR conversation to request it. The author
must currently have repository write, maintain, or admin access; the PR must be
open and its head branch must live in this repository. Post the command again
for a new run after pushing changes. Edited comments do not trigger a run.

The standalone **ds-shots** workflow captures the current PR head and exact base
commit at 320 and 430 pixels, compares them, and runs the head's regression specs and i18n overflow gate.
It retains the existing backdoor scan before installing or building PR code.
It uploads screenshots and a report, then the existing publisher updates the
sticky visual-diff comment. It stays advisory and does not rerun the dev CI suite
or deploy anything. Automatic visual checks for other PR bases and baseline
captures on `main` and `feat/design-system` keep their existing behavior.

For the Actions **Run workflow** button, select the PR head branch and supply
`pr_number`; `expected_head` is optional. Selecting another branch is rejected.

Rollout: `ds-shots-request.yml`, `ds-shots.yml`, and the publisher change must be
merged into the default branch (`main`) before GitHub will recognize the comment
and dispatch triggers. The capture workflow must also exist on the PR head
branch: after the dev change merges, update existing PR branches from `dev`.
The publisher runs trusted code from `main`; capture jobs have no repository
write permission and never publish comments themselves.
