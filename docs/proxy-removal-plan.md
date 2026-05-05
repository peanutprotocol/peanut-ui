# Plan: Remove `/api/proxy/*` Routes

## Context

The generic proxy routes (`/api/proxy/`, `/api/proxy/get/`, `/api/proxy/patch/`, `/api/proxy/delete/`, `/api/proxy/withFormData/`) exist because the frontend historically used `'use server'` action files that ran server-side. When those were converted to client-side for Capacitor, `serverFetch` was added to route web calls through these proxies. The goal is to eliminate the proxy layer entirely — have the browser call the backend directly on all platforms.

## What the proxies do today

1. **Inject `PEANUT_API_KEY`** — server-only env var, can't be sent from browser
2. **Forward `x-forwarded-for`** — user IP for rate limiting
3. **Forward `Set-Cookie`** — backend → browser cookie relay (critical for passkey JWT)
4. **Handle FormData** — `withFormData` proxy lets browser auto-set multipart boundary
5. **Bypass CORS** — server-to-server calls have no CORS restrictions

## What depends on them

- **`serverFetch`** — routes all action/service/hook calls through proxies on web (34 files)
- **`next_proxy_url`** — SDK calls: `claim-v3`, `deposit-3009`, `claim-x-chain`, `get-squid-route` + username check in `Signup.tsx`
- **`sendLinks.ts` + `charges.ts`** — FormData uploads via `withFormData` proxy
- **Passkey flow** — `PASSKEY_SERVER_URL=/api/proxy/passkeys` in env, proxy forwards Set-Cookie for JWT storage

## Risks and blockers

### 1. API key — BLOCKER (backend change required)
The backend still checks `api-key` on some routes (relayer `assertApiKey`, raffle routes, points admin). The proxy injects this server-side. Without the proxy, the browser can't send it (it's not a `NEXT_PUBLIC_` var and shouldn't be — it's a secret).

**To unblock:** Remove all `assertApiKey` / `requireApiKey` calls from the backend. Replace with JWT-only auth or no auth (for public routes). The native app PR already made `api-key` optional (`Type.Optional`) on user/bridge/passkey routes, but relayer and raffle routes still call `assertApiKey`.

**Risk:** If any route still validates api-key and the browser doesn't send it → 401/403. Need an exhaustive backend audit before removing the proxy.

### 2. JWT cookie after passkey login — BLOCKER (SDK limitation)
The passkey flow uses `PASSKEY_SERVER_URL=/api/proxy/passkeys`. The zerodev SDK calls this URL internally. The backend responds with `Set-Cookie: jwt-token=xxx`. The proxy forwards this as a same-origin response → browser stores the cookie.

Without the proxy, the Set-Cookie comes cross-origin. Browser won't store it unless the SDK's internal fetch uses `credentials: 'include'` — which it doesn't, and you can't configure it.

**To unblock (choose one):**
- **Option A:** After `toWebAuthnKey()` succeeds, make a separate API call to get the JWT token and store it via `setAuthToken()`. Requires a new "get my token" endpoint or extracting the token from the passkey response somehow.
- **Option B:** Fork/patch the zerodev SDK to use `credentials: 'include'` in its passkey server fetch calls. Then configure backend CORS with `credentials: true` (already done) and set cookie with `SameSite=None; Secure`.
- **Option C:** Keep a minimal passkey-only proxy route (not a generic catch-all). Set `PASSKEY_SERVER_URL=/api/passkey-proxy/passkeys` and delete the generic proxy routes.

### 3. Peanut SDK `baseUrl` calls — MEDIUM risk
`useClaimLink` and `useCreateLink` pass `next_proxy_url` as `baseUrl` to the peanut SDK for `claim-v3`, `deposit-3009`, `claim-x-chain`, `get-squid-route`. The SDK makes its own fetch calls to these URLs.

**To unblock:** Change `next_proxy_url` to always be `PEANUT_API_URL`. The SDK calls go directly to the backend. These relayer endpoints still call `assertApiKey` with a skip for missing keys (`if (apiKey && apiKey !== 'native-app')`), so they should work without api-key. Need to verify.

**Risk:** If the SDK sends headers that trigger CORS preflight and the backend doesn't allow them → SDK calls fail. Test thoroughly.

### 4. FormData uploads — LOW risk
`sendLinks.ts` and `charges.ts` use `/api/proxy/withFormData/` for file uploads. Without the proxy, the browser sends FormData directly to the backend.

**To unblock:** Use `serverFetch` (or direct fetch) to the backend with FormData body. Don't set `Content-Type` — let the browser auto-set multipart boundary. The backend already accepts multipart (it uses `@fastify/multipart`). Need `credentials: 'include'` or auth header for authenticated uploads.

### 5. CORS on all environments — LOW risk (mostly done)
Backend CORS already allows `*.peanut.me`, `*.vercel.app`, `capacitor://`, `http://localhost:*`. This covers all environments. Just need to verify no edge cases (e.g., custom staging domains).

### 6. User IP forwarding — LOW risk
Without proxy, the backend sees the user's real IP directly (browser → backend). The `x-forwarded-for` header is only needed when going through a proxy/CDN. Direct calls don't need it. Vercel's edge might add it anyway.

## Migration steps (in order)

### Phase 1: Backend — remove api-key dependency
1. Audit every route that calls `assertApiKey` — remove or replace with JWT auth
2. Remove `api-key` from all route schemas (not just `Type.Optional`, fully remove)
3. Deploy to staging, verify native app still works
4. Keep `api-key` support temporarily (don't reject it, just don't require it) for backward compat during migration

### Phase 2: Fix passkey JWT storage without proxy
1. Choose option A, B, or C from blocker #2
2. Implement and test on staging
3. Verify: signup → passkey register → JWT stored → authenticated calls work
4. This is the hardest part — test thoroughly on web, PWA, and native

### Phase 3: Update `serverFetch` to go direct on web
1. Change `serverFetch` to always call `PEANUT_API_URL + path` (same as native path)
2. Add `getAuthHeaders()` for all platforms (not just native)
3. Remove proxy routing logic (the switch statement)
4. At this point, `serverFetch` becomes just `fetchWithSentry(PEANUT_API_URL + path, { headers: getAuthHeaders(), ...options })`
5. Update `next_proxy_url` to always be `PEANUT_API_URL`
6. Fix `sendLinks.ts` and `charges.ts` FormData to go direct

### Phase 4: Fix SDK calls
1. Change `next_proxy_url` to `PEANUT_API_URL` on web too
2. Test claim, deposit, cross-chain claim, squid routing
3. Verify these SDK endpoints work without api-key

### Phase 5: Delete proxy routes
1. Delete `src/app/api/proxy/` directory (5 route files)
2. Remove proxy-related code from `serverFetch` (it's now dead code)
3. Simplify `serverFetch` or merge with `apiFetch` or remove entirely (all callers just use `fetchWithSentry` + `getAuthHeaders` directly)
4. Update tests

### Phase 6: Cleanup
1. Remove `next_proxy_url` constant (replace with `PEANUT_API_URL` everywhere)
2. Remove `apiFetch` if no longer used
3. Remove `PEANUT_API_KEY` from Vercel env (no longer needed by frontend)
4. Clean up backend — remove `Type.Optional(Type.String())` for api-key from all schemas

## What NOT to change (stays regardless)

- `/api/peanut/user/*` routes — these are dedicated server-side routes for cookie auth (login-user, get-user-from-cookie, logout-user). they read/write httpOnly cookies server-side. these are NOT generic proxies.
- `/api/exchange-rate/` — dedicated route with caching logic
- `/api/health/*` — health check routes
- Passkey proxy (if option C is chosen) — minimal dedicated route, not generic catch-all

## Estimated scope

| Phase | Files | Risk | Depends on |
|-------|-------|------|------------|
| 1. Backend api-key removal | ~10 BE route files | medium | nothing |
| 2. Passkey JWT fix | 2-3 FE files + possibly BE | high | phase 1 |
| 3. serverFetch direct | 1 FE file (api-fetch.ts) | low | phase 1, 2 |
| 4. SDK calls | 3 FE files | medium | phase 1 |
| 5. Delete proxy routes | 5 FE files deleted | low | phase 3, 4 |
| 6. Cleanup | ~5 FE files | low | phase 5 |
