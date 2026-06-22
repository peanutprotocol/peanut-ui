# Demo mode

App-Store reviewer demo: a fully navigable, **native-only**, client-side walkthrough with
believable data and **no backend**. There is no demo account, no `/demo-login`, no real
reads or writes — each reviewer gets an isolated, deterministic session.

## How it works

1. **Entry.** The invite code `demo` (case-insensitive) flips demo mode on. See
   [`src/utils/demo.ts`](../src/utils/demo.ts): `enableDemoMode()` sets an in-memory flag
   plus a `localStorage` key. `isDemoMode()` returns `true` only when **both**
   `isCapacitor()` is true **and** the flag is set — so it is always `false` on web.

2. **Network interception.** Every API request funnels through `callApi` in
   [`src/utils/api-fetch.ts`](../src/utils/api-fetch.ts) (both `apiFetch` and `serverFetch`
   are aliases of it). The first line short-circuits in demo mode:

   ```ts
   if (isDemoMode()) return demoRespond(path, options)
   ```

   so no request ever reaches the network and no `authorization` header is required.

3. **The router.** [`src/utils/demo-api.ts`](../src/utils/demo-api.ts) — `demoRespond(path, options)`
   strips the query string, matches `{method, path}` against an ordered table (literal paths
   before `:param` paths), and returns `new Response(JSON.stringify(data), { status: 200 })`.
   Unmatched routes hit a **shape-aware fallback** (`[]` for collection-ish paths, `{}`
   otherwise) so a consumer never throws on `undefined.map`, and log
   `[demo-api] unmocked <method> <path>` in dev so QA can spot gaps.

4. **Fixtures.** All demo data lives in
   [`src/constants/demo-data.ts`](../src/constants/demo-data.ts): `DEMO_USER`,
   `DEMO_CONTACTS`, `DEMO_HISTORY_ENTRIES`, `DEMO_LIMITS`, `DEMO_BALANCE_UNITS`,
   `DEMO_ADDRESS`. `demo-api.ts` composes its responses from these plus inline canned objects.

5. **WebSocket.** `getWebSocketInstance()` in
   [`src/services/websocket.ts`](../src/services/websocket.ts) returns `null` in demo mode
   (callers already handle `null`), avoiding the mixed-content `wss://` failure.

6. **No real money.** UserOps / passkey signing are hard-stopped elsewhere
   (`kernelClient.context`, `useZeroDev`, `useSpendBundle`), so even "enabled" rails and
   completed flows are purely simulated.

### Relationship to the per-hook demo branches

A few hooks short-circuit demo mode *before* `callApi` and source their values from
`demo-data.ts`: `useUserQuery` (`/users/me` + a synchronous Redux seed that fixes the
no-bounce race), `useTransactionHistory` (history), `useWallet` (balance), `useCapabilities`.
These remain the primary path; the interceptor is the **backstop** that also covers
`/users/me`, `/users/history`, etc., so any code path that reaches the network still gets
synthetic data instead of a 401.

> Exception: `sendLinksApi.create` posts multipart `FormData` via `fetchWithSentry`
> directly (bypassing `callApi`), so it calls `demoRespond` explicitly in demo mode.

## Adding a mock

1. Find the endpoint (path + method + expected response shape) — grep the `serverFetch(` /
   `apiFetch(` call site, or check `src/types/api.openapi.json`.
2. Add a row to the `ROUTES` table in `demo-api.ts`. Use `:param` segments for path params;
   keep literal paths above `:param` paths that could also match.
3. If the response is real *data* (not a one-off canned success), add a fixture to
   `demo-data.ts` and reference it, so data has one home.
4. Match the consumer's expected envelope exactly (e.g. `{ items, nextCursor }` for
   notifications, a bare `[]` array for `/users/:id/rewards`). When unsure, the consumer's
   `.json()` usage is the source of truth.

## QA screen-walk checklist

Enter invite code `demo` on a native build, then visit each screen and confirm: **no auth
errors, populated-or-empty states only, headline flows reach a simulated success screen.**
Watch the console for `[demo-api] unmocked` and close any gap.

- [ ] Home (balance, latest activity)
- [ ] Send → Contacts (alice/bob/carol/dave populated) and Send link
- [ ] Request payment
- [ ] Add money — US, BR, AR (quote → review → simulated success)
- [ ] Withdraw / cash out — US, BR, AR (incl. Bridge ToS step)
- [ ] QR pay (scan → complete)
- [ ] Activity / history (infinite scroll) + a receipt detail
- [ ] Profile + sub-pages, Settings
- [ ] Rewards / Points
- [ ] Card
- [ ] Notifications
- [ ] Support

## Safety / tests

`src/utils/__tests__/demo-api.test.ts` covers routing, param extraction, the shape-aware
fallback, and asserts demo mode is **web-inert** (`isDemoMode()` is `false` when
`isCapacitor()` is false, even with the flag set). Run `pnpm test` and `pnpm typecheck`.
