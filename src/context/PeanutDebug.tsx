'use client'

/**
 * PeanutDebug — install `window.debug.*` helpers in local dev (also exposed
 * as `window.cheats` for muscle memory).
 *
 * Everything here wraps the peanut-api-ts `/dev/cheats/*` endpoints (which
 * themselves delegate to the Nutcracker harness library — engineering/qa/
 * lib/*). Same backend as the /dev/debug UI panel, just callable from the
 * browser console so you don't have to navigate.
 *
 * Only installs in dev builds (localhost gate). Every call logs through a
 * pink banner so it's visible in the DevTools console.
 */

import { useEffect } from 'react'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { debugLog } from '@/utils/debug-console'
import { logRunMode } from '@/utils/mode'

export function PeanutDebug() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        const hostname = window.location.hostname
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
        if (!isLocalhost) return

        const secret =
            (process.env.NEXT_PUBLIC_TEST_HARNESS_SECRET as string | undefined) ??
            'local-harness-secret-must-be-at-least-32-characters-long'

        const currentUserId = () => {
            // best-effort: read from /api/peanut/user/get-user-from-cookie output
            // via a pre-cached value; otherwise return null and let caller pass.
            return (window as any).__peanut_user_id ?? null
        }

        // Captures the most recent BE response so callers can surface the
        // structured `hint`/`suggestions` fields in helpful errors instead of
        // generic "fetch failed" / "user not found".
        let lastResponse: { status?: number; json?: any; networkError?: string } = {}

        async function call(path: string, body?: object, method: 'GET' | 'POST' = 'POST') {
            const url =
                method === 'GET' && body
                    ? `${PEANUT_API_URL}${path}?${new URLSearchParams(body as any).toString()}`
                    : `${PEANUT_API_URL}${path}`
            const start = performance.now()
            debugLog(`→ ${method} ${path}`, body ?? '')
            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'content-type': 'application/json', 'x-test-harness-secret': secret },
                    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
                })
                const json = await res.json().catch(() => ({}))
                const ms = Math.round(performance.now() - start)
                const ok = res.ok && json?.ok !== false
                debugLog(`${ok ? '✓' : '✗'} ${method} ${path} (${ms}ms)`, json)
                lastResponse = { status: res.status, json }
                return json
            } catch (err) {
                lastResponse = { networkError: (err as Error).message }
                debugLog(`✗ ${method} ${path} — network error: ${(err as Error).message}`)
                throw new Error(
                    `cheat call ${method} ${path} failed: ${(err as Error).message}.\n` +
                        `Hint: is the API running on ${PEANUT_API_URL}? Check 'qa status' or tail engineering/qa/logs/api.log.`
                )
            }
        }

        // Build a friendly multi-line error string. console.error renders
        // multi-line strings as a stacked block, so the dev sees suggestions
        // inline instead of having to expand a Promise rejection.
        function friendlyError(headline: string, lines: string[]): Error {
            const body = lines.filter(Boolean).join('\n  ')
            return new Error(body ? `${headline}\n  ${body}` : headline)
        }

        const resolveUserId = async (userId?: string) => {
            if (userId) return userId
            const cached = currentUserId()
            if (cached) return cached
            const res = await fetch('/api/peanut/user/get-user-from-cookie', { method: 'POST', credentials: 'include' })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
            const uid = res?.user?.userId
            if (uid) (window as any).__peanut_user_id = uid
            return uid ?? null
        }

        // Default harness PK for the local-dev impersonate cheat. Wired in
        // peanut_local_staging as hugostagqa's WALLET_SMART address override
        // (SA: 0x478Eb47326...). Hardcoded here so `debug.impersonate('hugostagqa')`
        // works in one shot — no need to pass `{ pk }` every time. Local-only;
        // gated by HARNESS_ENABLED + the dev cheat route's requireTestMode.
        // Sandbox harness keys are NOT secrets — Konrad's call.
        const DEFAULT_HARNESS_PK =
            '0x8501e6e37f45d268618debb9f0d95528ca90a2eadcb29ac2277c0284d0ec861b'

        const debugApi: any = {
            // Local-dev impersonation cheat. Mints a JWT for the given userId
            // OR username (case-insensitive lookup against /dev/cheats/whoami)
            // and drops it into the jwt-token cookie + sets the harness ECDSA
            // signer flags so transactions sign without a passkey.
            //
            // Usage:
            //   debug.impersonate('hugostagqa')          // by username, default PK
            //   debug.impersonate('7077676f-2bba-...')   // by userId UUID
            //   debug.impersonate('user', { pk: '0x..' }) // override PK
            //   debug.impersonate('user', { skipSigner: true })  // cookie only
            async impersonate(userIdOrUsername: string, opts: { skipSigner?: boolean; pk?: string } = {}) {
                const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                let userId = userIdOrUsername
                if (!uuidRe.test(userIdOrUsername)) {
                    const j = await call('/dev/cheats/userid-by-username', { username: userIdOrUsername }, 'GET')
                    if (!j?.userId) {
                        const sug: string[] = j?.suggestions ?? []
                        const total: number | undefined = j?.totalUsers
                        throw friendlyError(`username '${userIdOrUsername}' not found in app.users`, [
                            sug.length
                                ? `Did you mean: ${sug.map((s) => `'${s}'`).join(', ')}?`
                                : `No usernames start with '${userIdOrUsername.slice(0, 3)}'.`,
                            total != null ? `(${total} users in this DB)` : '',
                            'Tip: list available users with debug.listUsers().',
                        ])
                    }
                    userId = j.userId
                }
                const j = await call('/dev/cheats/mint-jwt', { userId })
                if (!j?.token) {
                    throw friendlyError('mint-jwt failed', [
                        j?.hint ?? `BE returned: ${JSON.stringify(j)}`,
                        'Common causes: API not on the right DB, JWT_SECRET unset, or harness secret mismatched.',
                    ])
                }
                document.cookie = `jwt-token=${j.token}; path=/; max-age=2592000; SameSite=Lax`
                if (!opts.skipSigner) {
                    // Resolution order: explicit opt > default. We deliberately
                    // do NOT consult localStorage here — a stale-bad PK from a
                    // prior session would otherwise win over the default and
                    // the kernel would silently fail to init (the symptom: a
                    // hugostagqa impersonate that "ran fine" but balance keeps
                    // loading and send-link insta-fails). `impersonate` should
                    // reset to known-good every time. Use `debug.harnessSigner(pk)`
                    // if you want to keep a custom PK across calls.
                    const pk = opts.pk ?? DEFAULT_HARNESS_PK
                    localStorage.setItem('__harness_skip_passkey', 'true')
                    localStorage.setItem('__harness_ecdsa_pk', pk)
                    localStorage.setItem('__harness_ecdsa_sponsored', 'true')
                }
                debugLog(`impersonating ${userId} — reloading /home`)
                location.href = '/home'
            },
            // Idempotent harness-signer setup without changing the JWT.
            // Useful if `useZeroDev not ready` shows up on a tab that already
            // has a JWT but no localStorage signer flags — just run
            // `debug.harnessSigner()` and reload.
            harnessSigner(pk?: string) {
                if (pk && !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
                    throw friendlyError('invalid PK format', [
                        `Got: ${pk.slice(0, 12)}… (length=${pk.length})`,
                        'Expected: 0x-prefixed 32-byte hex string (66 chars total).',
                        'Tip: pass no argument to use the default harness PK.',
                    ])
                }
                const key = pk ?? localStorage.getItem('__harness_ecdsa_pk') ?? DEFAULT_HARNESS_PK
                localStorage.setItem('__harness_skip_passkey', 'true')
                localStorage.setItem('__harness_ecdsa_pk', key)
                localStorage.setItem('__harness_ecdsa_sponsored', 'true')
                debugLog(`harness signer set (pk=${key.slice(0, 10)}…) — reload to take effect`)
                location.reload()
            },
            // Re-log the current run-mode (api / chain / signing) with
            // big yellow text. Useful when you've been heads-down for an
            // hour and forgot whether this tab is sandbox or staging.
            mode() {
                return logRunMode('debug.mode():')
            },
            // Lists usernames from app.users so devs can find someone to
            // impersonate without remembering names. Pass an optional prefix
            // to narrow the result.
            async listUsers(prefix: string = '', limit: number = 20) {
                const j = await call('/dev/cheats/list-users', { prefix, limit }, 'GET')
                if (!j?.users) {
                    throw friendlyError('listUsers failed', [
                        `BE returned: ${JSON.stringify(j)}`,
                        'Make sure the API is running with HARNESS_ENABLED=true and the harness secret matches.',
                    ])
                }
                debugLog(`${j.users.length} users (of ${j.totalUsers ?? '?'} total):\n  ` + j.users.join('\n  '))
                return j.users as string[]
            },
            logout() {
                return debugApi.signOut()
            },
            // DB resets / session wipes
            async signOut() {
                // Clear every cookie + storage + IndexedDB (full reset of tab)
                document.cookie.split(';').forEach((c) => {
                    const name = c.split('=')[0].trim()
                    if (!name) return
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`
                })
                try {
                    localStorage.clear()
                } catch {}
                try {
                    sessionStorage.clear()
                } catch {}
                try {
                    const dbs = (await (indexedDB as any).databases?.()) ?? []
                    await Promise.all(
                        dbs.map(
                            (d: { name: string }) =>
                                new Promise((r) => {
                                    const req = indexedDB.deleteDatabase(d.name)
                                    ;(req as any).onsuccess =
                                        (req as any).onerror =
                                        (req as any).onblocked =
                                            () => r(null)
                                })
                        )
                    )
                } catch {}
                debugLog('signed out — reloading')
                location.reload()
            },

            async whoami(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/whoami', { userId: uid }, 'GET')
            },

            async fund(usdc: string = '10', userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                const base = BigInt(Math.round(parseFloat(usdc) * 1e6))
                return call('/dev/cheats/fund-sa', { userId: uid, usdc: base.toString() })
            },

            async approveKyc(provider: 'bridge' | 'manteca' | 'sumsub' = 'bridge', country = 'US', userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/approve-kyc', { userId: uid, provider, country })
            },

            async simulateBridgeDeposit(amountUsd: string = '25.00', userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/simulate-bridge-deposit', { userId: uid, amountUsd })
            },

            /**
             * Advance a pending Bridge ONRAMP intent to PAYMENT_PROCESSED — the
             * state Peanut treats as "complete." Bridge sandbox fires no
             * payments webhooks, so this cheat synthesizes the webhook payload
             * server-side and feeds it into the real handler.
             *
             * `intentOrTransferId` accepts either the TransactionIntent.id or
             * the Bridge transfer id (both work).
             * See peanut-api-ts/src/routes/dev/impersonators/README.md.
             */
            async completeBridgeOnramp(
                intentOrTransferId: string,
                opts?: { exchangeRate?: number; developerFee?: string }
            ) {
                return call('/dev/cheats/complete-bridge-onramp', {
                    intentOrTransferId,
                    ...(opts ?? {}),
                })
            },

            /** Same contract as completeBridgeOnramp, for offramps. */
            async completeBridgeOfframp(
                intentOrTransferId: string,
                opts?: { exchangeRate?: number; developerFee?: string }
            ) {
                return call('/dev/cheats/complete-bridge-offramp', {
                    intentOrTransferId,
                    ...(opts ?? {}),
                })
            },

            /**
             * Drive a Bridge transfer to a terminal failure state.
             * `terminalState` defaults to 'error'; use 'returned' / 'undeliverable'
             * / 'refunded' for rail-specific failures.
             */
            async failBridgeTransfer(
                intentOrTransferId: string,
                reason: string,
                terminalState?: 'error' | 'returned' | 'undeliverable' | 'refunded'
            ) {
                return call('/dev/cheats/fail-bridge-transfer', {
                    intentOrTransferId,
                    reason,
                    ...(terminalState ? { terminalState } : {}),
                })
            },

            /**
             * Advance a pending Rhino SDA deposit through
             * DEPOSIT_ADDRESS_CREATED → BRIDGE_PENDING → BRIDGE_ACCEPTED →
             * BRIDGE_EXECUTED. Rhino has no sandbox so this cheat synthesizes
             * the webhook payloads server-side and feeds them through the real
             * `processRhinoWebhookEvent` handler.
             *
             * Prerequisite: you must have already called `POST /rhino/deposit`
             * (UI does this when the user opens the deposit screen) so the SDA
             * is registered in the in-memory status store. Pass that SDA back
             * here as `depositAddress`.
             *
             * See peanut-api-ts/src/routes/dev/impersonators/README.md.
             */
            async completeRhinoDeposit(args: {
                depositAddress: string
                chainIn?: string
                token?: 'USDC' | 'USDT'
                depositor?: string
                recipient: string
                amountIn?: string
                amountOut?: string
                amountOutUsd?: number
            }) {
                return call('/dev/cheats/complete-rhino-deposit', {
                    depositAddress: args.depositAddress,
                    chainIn: args.chainIn ?? 'BASE',
                    token: args.token ?? 'USDC',
                    depositor: args.depositor ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
                    recipient: args.recipient,
                    amountIn: args.amountIn ?? '1.00',
                    amountOut: args.amountOut ?? '0.99',
                    amountOutUsd: args.amountOutUsd ?? 0.99,
                })
            },

            /**
             * Same contract as completeRhinoDeposit but for request-fulfilment
             * SDAs (registered via POST /rhino/request-fulfilment). Downstream
             * effect: chargeService.createPayment runs on the associated
             * charge, moving it to PAID.
             */
            async completeRhinoReqFulfilment(args: {
                depositAddress: string
                chainIn?: string
                token?: 'USDC' | 'USDT'
                depositor?: string
                recipient: string
                amountIn?: string
                amountOut?: string
                amountOutUsd?: number
            }) {
                return call('/dev/cheats/complete-rhino-req-fulfilment', {
                    depositAddress: args.depositAddress,
                    chainIn: args.chainIn ?? 'BASE',
                    token: args.token ?? 'USDC',
                    depositor: args.depositor ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
                    recipient: args.recipient,
                    amountIn: args.amountIn ?? '1.00',
                    amountOut: args.amountOut ?? '0.99',
                    amountOutUsd: args.amountOutUsd ?? 0.99,
                })
            },

            /**
             * Drive a Rhino SDA (deposit or req-fulfilment) to BRIDGE_REFUNDED.
             * Shared helper — the store entry's paymentType determines downstream
             * effects via the real handler.
             */
            async failRhinoTransfer(args: {
                depositAddress: string
                chainIn?: string
                token?: 'USDC' | 'USDT'
                depositor?: string
                recipient: string
                amountIn?: string
                amountOut?: string
                amountOutUsd?: number
                reason?: string
            }) {
                return call('/dev/cheats/fail-rhino-transfer', {
                    depositAddress: args.depositAddress,
                    chainIn: args.chainIn ?? 'BASE',
                    token: args.token ?? 'USDC',
                    depositor: args.depositor ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
                    recipient: args.recipient,
                    amountIn: args.amountIn ?? '1.00',
                    amountOut: args.amountOut ?? '0.99',
                    amountOutUsd: args.amountOutUsd ?? 0.99,
                    ...(args.reason ? { reason: args.reason } : {}),
                })
            },

            async resetMe(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/reset-user', { userId: uid })
            },

            /**
             * One-shot "make me a fully activated user": KYC bridge + manteca
             * + sumsub, fund $100 USDC, simulate Bridge $25 deposit, complete
             * every PROCESSING intent. Returns per-step ok/error.
             */
            async fullSetup(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/full-setup', { userId: uid })
            },

            /**
             * Find every PROCESSING TransactionIntent for me and run the
             * matching impersonator. Bridge ONRAMP/OFFRAMP only.
             */
            async autoComplete(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/auto-complete-pending', { userId: uid })
            },

            async ledgerHealth() {
                return call('/dev/ledger/health', undefined, 'GET')
            },

            async ledgerHistory(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/ledger/history', { userId: uid }, 'GET')
            },

            faucetHelp() {
                // Harness EOA address. Stays in sync with HARNESS_WALLET_PRIVATE_KEY
                // derivation (engineering/qa/setup/test-wallet.mjs).
                const addr = '0x441D796c62548F74505DE578c458908d936A3B53'
                const msg = [
                    '',
                    '🪙 Harness EOA is the USDC source for debug.fund().',
                    '',
                    `   Address:  ${addr}`,
                    '   Chain:    Arbitrum Sepolia (421614)',
                    '',
                    '   Refill:',
                    '     1. Open https://faucet.circle.com/',
                    '     2. Select "Arb Sepolia"',
                    `     3. Paste ${addr}`,
                    '     4. Click "Send me USDC" — 10 USDC per click, ~60s cooldown.',
                    '',
                    "   Circle's canonical USDC has no public mint(). Mock would break",
                    '   Bridge + Manteca sandboxes which hardcode the real contract.',
                    '',
                ].join('\n')
                debugLog('faucet help\n' + msg)
                if (typeof window !== 'undefined') {
                    window.open('https://faucet.circle.com/', '_blank', 'noopener,noreferrer')
                }
                return addr
            },

            help() {
                const lines = [
                    'debug.fullSetup()                   one-click: KYC-all + fund + simulate-deposit + complete-pending',
                    'debug.autoComplete()                complete every PROCESSING intent (Bridge ONRAMP/OFFRAMP)',
                    'debug.impersonate(userIdOrUsername) mint JWT + harness signer for any user; reloads to /home',
                    'debug.harnessSigner(pk?)            re-arm the ECDSA signer without changing JWT; reloads',
                    'debug.listUsers(prefix?, limit=20)  list usernames available to impersonate (default 20)',
                    'debug.mode()                        log api/chain/signing run-mode (yellow=sandbox, red=real money)',
                    'debug.logout()                      alias for signOut()',
                    'debug.signOut()                     clear cookies + storage + reload',
                    'debug.whoami()                      KYC / wallet / provider ids',
                    'debug.fund(usdc="10")               harness EOA → your SA (default $10)',
                    'debug.faucetHelp()                  print harness EOA + open Circle faucet',
                    'debug.approveKyc(provider, country) "bridge" (US/EU), "manteca" (AR), "sumsub"',
                    'debug.simulateBridgeDeposit("25")   fires sandbox VA simulate_deposit (does NOT advance transfers — see completeBridgeOnramp)',
                    'debug.completeBridgeOnramp(id, opts)  advance pending onramp → PAYMENT_PROCESSED (impersonator)',
                    'debug.completeBridgeOfframp(id, opts) advance pending offramp → PAYMENT_PROCESSED (impersonator)',
                    'debug.failBridgeTransfer(id, reason)  drive transfer to terminal failure (impersonator)',
                    'debug.completeRhinoDeposit({ depositAddress, recipient, ... })   advance Rhino SDA deposit → BRIDGE_EXECUTED (impersonator)',
                    'debug.completeRhinoReqFulfilment({ depositAddress, recipient, ... })  advance Rhino req-fulfilment SDA → BRIDGE_EXECUTED',
                    'debug.failRhinoTransfer({ depositAddress, recipient, ... })      drive Rhino SDA to BRIDGE_REFUNDED (impersonator)',
                    'debug.resetMe()                     wipes your bridge/manteca/ledger rows',
                    'debug.ledgerHealth()                ledger row counts + invariant checks',
                    'debug.ledgerHistory()               ledger intents for this user (raw)',
                ].join('\n')
                debugLog('help\n' + lines)
                return lines
            },
        }

        ;(window as any).debug = debugApi
        ;(window as any).cheats = debugApi
        debugLog('installed. type debug.help() — or debug.fullSetup() to one-shot activate. (alias: cheats)')

        return () => {
            delete (window as any).debug
            delete (window as any).cheats
        }
    }, [])

    return null
}
