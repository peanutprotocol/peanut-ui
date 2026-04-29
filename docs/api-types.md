# API types — generated from BE OpenAPI

`src/types/api.generated.ts` is auto-generated from peanut-api-ts's
OpenAPI spec (emitted by `@fastify/swagger` from each route's TypeBox
schema). It exists for **drift detection** — call sites can opt in to
typed responses incrementally; nothing is required to migrate.

## Regenerating

Two scripts:

- **`pnpm gen:api`** (offline) — regenerates types from the committed
  `src/types/api.openapi.json` snapshot. CI runs this; should be a no-op.
- **`pnpm gen:api:live`** (refreshes the snapshot too) — fetches a fresh
  spec from a running BE and updates both files. Use this after a BE
  route schema change. Reads `PEANUT_API_OPENAPI_URL` (default
  `http://localhost:5050/openapi.json`).

Both files are committed to git:

- `src/types/api.openapi.json` — the spec snapshot, source of truth for FE typing
- `src/types/api.generated.ts` — types regenerated from the snapshot

PR reviewers see contract changes in the snapshot diff.

## Drift CI gate

```bash
pnpm check:api   # runs gen:api + git diff --exit-code; fails on drift
```

CI runs this on every PR. If you change a BE route schema and forget to
regenerate, `check:api` fails the PR. Fix:

1. boot BE: `engineering/qa/bin/qa api up`
2. `pnpm gen:api:live` (refreshes both snapshot + types)
3. commit both files

## Using the types

The recommended pattern (no codegen client; types only):

```ts
import type { paths } from '@/types/api.generated'

type ChargeResponse =
    paths['/charges/{chargeId}']['get']['responses']['200']['content']['application/json']

const res = await apiFetch('/charges/' + uuid, '/api/peanut/charge', { method: 'GET' })
const charge = (await res.json()) as ChargeResponse
```

For new call sites, prefer this over hand-rolled types — the type is
pulled from the BE schema, so a BE shape change shows up as a TS error.

## When to regenerate

- After any BE route schema change (add/remove a route, add/remove a field on a request/response)
- When CI's typecheck flags a stale type — pull `main`, run `pnpm gen:api`, commit
- Before opening a PR that touches a BE route

## Limitations

- The generator only sees what's in TypeBox `schema`. Routes that don't declare a response schema appear as `unknown` content. Fixing that is per-route and incremental.
- `apiFetch` itself doesn't auto-type yet (returns `Response`). Call sites cast manually. A typed `apiFetch` wrapper is the natural follow-up if drift detection proves valuable.
