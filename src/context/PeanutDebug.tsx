'use client'

/**
 * PeanutDebug — install `window.peanutDebug.*` helpers in local dev.
 *
 * Everything here wraps the peanut-api-ts `/dev/cheats/*` endpoints (which
 * themselves delegate to the Nutcracker harness library — engineering/qa/
 * lib/*). Same backend as /dev/cheats UI panel, just callable from the
 * browser console so you don't have to navigate.
 *
 * Only installs in dev builds (keyed off `/dev/cheats` gating — localhost
 * only, not prod). Safe to ship — the mount is behind a check.
 */

import { useEffect } from 'react'
import { PEANUT_API_URL } from '@/constants/general.consts'

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

        async function call(path: string, body?: object, method: 'GET' | 'POST' = 'POST') {
            const url =
                method === 'GET' && body
                    ? `${PEANUT_API_URL}${path}?${new URLSearchParams(body as any).toString()}`
                    : `${PEANUT_API_URL}${path}`
            const res = await fetch(url, {
                method,
                headers: { 'content-type': 'application/json', 'x-test-harness-secret': secret },
                body: method === 'POST' && body ? JSON.stringify(body) : undefined,
            })
            const json = await res.json().catch(() => ({}))
            return json
        }

        const resolveUserId = async (userId?: string) => {
            if (userId) return userId
            const cached = currentUserId()
            if (cached) return cached
            const res = await fetch('/api/peanut/user/get-user-from-cookie', { credentials: 'include' })
                .then((r) => r.ok ? r.json() : null)
                .catch(() => null)
            const uid = res?.user?.userId
            if (uid) (window as any).__peanut_user_id = uid
            return uid ?? null
        }

        const peanutDebug = {
            // DB resets / session wipes
            async signOut() {
                // Clear every cookie + storage + IndexedDB (full reset of tab)
                document.cookie.split(';').forEach((c) => {
                    const name = c.split('=')[0].trim()
                    if (!name) return
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${location.hostname}`
                })
                try { localStorage.clear() } catch {}
                try { sessionStorage.clear() } catch {}
                try {
                    const dbs = (await (indexedDB as any).databases?.()) ?? []
                    await Promise.all(
                        dbs.map((d: { name: string }) =>
                            new Promise((r) => {
                                const req = indexedDB.deleteDatabase(d.name)
                                ;(req as any).onsuccess = (req as any).onerror = (req as any).onblocked = () => r(null)
                            })
                        )
                    )
                } catch {}
                console.log('[peanutDebug] signed out — reloading')
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

            async resetMe(userId?: string) {
                const uid = await resolveUserId(userId)
                if (!uid) return { error: 'not signed in' }
                return call('/dev/cheats/reset-user', { userId: uid })
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
                    '🪙 Harness EOA is the USDC source for peanutDebug.fund().',
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
                console.log(msg)
                if (typeof window !== 'undefined') {
                    window.open('https://faucet.circle.com/', '_blank', 'noopener,noreferrer')
                }
                return addr
            },

            help() {
                const lines = [
                    'peanutDebug.signOut()                     clear cookies + storage + reload',
                    'peanutDebug.whoami()                      KYC / wallet / provider ids',
                    'peanutDebug.fund(usdc="10")               harness EOA → your SA (default $10)',
                    'peanutDebug.faucetHelp()                  print harness EOA + open Circle faucet',
                    'peanutDebug.approveKyc(provider, country) "bridge" (US/EU), "manteca" (AR), "sumsub"',
                    'peanutDebug.simulateBridgeDeposit("25")   fires sandbox simulate_deposit',
                    'peanutDebug.resetMe()                     wipes your bridge/manteca/ledger rows',
                    'peanutDebug.ledgerHealth()                ledger row counts + dual-write stats',
                    'peanutDebug.ledgerHistory()               ledger intents for this user (raw)',
                ].join('\n')
                console.log(lines)
                return lines
            },
        }

        ;(window as any).peanutDebug = peanutDebug
        console.log(
            '%c[peanutDebug]%c installed. type peanutDebug.help() to see commands.',
            'background:#FF90E8;color:#000;padding:2px 6px;border-radius:2px;font-weight:bold',
            'color:inherit'
        )

        return () => {
            delete (window as any).peanutDebug
        }
    }, [])

    return null
}
