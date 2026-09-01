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
