'use client'

/**
 * Debug — comprehensive sandbox/dev panel.
 *
 * Wraps peanut-api-ts `/dev/cheats/*` endpoints (which delegate to the
 * Nutcracker harness library) and groups them so you don't have to remember
 * the right call sequence. Sections:
 *   - Presets   one-click chains (full setup, complete pending, kyc-all)
 *   - Funding   USDC top-ups
 *   - KYC       per-provider approvals
 *   - Bridge    deposits + impersonator completers
 *   - State     whoami / reset
 *
 * Mounts only on localhost (DevLayout gate). Endpoints require
 * NEXT_PUBLIC_TEST_HARNESS_SECRET.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { debugLog } from '@/utils/debug-console'

type ActionResult = { ok: boolean; raw: any; ms: number }

interface DebugAction {
    key: string
    label: string
    description: string
    run: () => Promise<unknown>
}

interface DebugSection {
    title: string
    actions: DebugAction[]
}

export default function DebugPage() {
    const { user, isFetchingUser } = useAuth()
    const [busy, setBusy] = useState<string | null>(null)
    const [results, setResults] = useState<Record<string, ActionResult>>({})
    const [whoami, setWhoami] = useState<any>(null)
    // Single-flight guard for non-idempotent endpoints (fund-sa, simulate-
    // deposit, reset-user). Button disabling alone doesn't survive a fast
    // double-tap before the next paint — the synchronous ref check does.
    const inFlightRef = useRef(false)

    const userId = user?.user?.userId ?? null
    const username = user?.user?.username ?? null

    const harnessSecret = process.env.NEXT_PUBLIC_TEST_HARNESS_SECRET ?? ''

    const call = useCallback(
        async (key: string, path: string, body?: object, method: 'GET' | 'POST' = 'POST') => {
            // Synchronous single-flight guard. Button disabling sets `busy`
            // via React state — a fast double-tap can fire two `call()`s
            // before the disabled prop renders. The ref check survives that
            // race so we never double-POST to fund-sa, reset-user, etc.
            if (inFlightRef.current) {
                debugLog(`SKIP ${method} ${path} — another debug action in flight`)
                return { ok: false, raw: { error: 'another debug action is already running' }, ms: 0 }
            }
            inFlightRef.current = true
            setBusy(key)
            const start = performance.now()
            debugLog(`→ ${method} ${path}`, body ?? '')
            try {
                const url =
                    method === 'GET' && body
                        ? `${PEANUT_API_URL}${path}?${new URLSearchParams(body as any).toString()}`
                        : `${PEANUT_API_URL}${path}`
                const res = await fetch(url, {
                    method,
                    headers: {
                        'content-type': 'application/json',
                        'x-test-harness-secret': harnessSecret || '',
                    },
                    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
                })
                const raw = await res.json()
                const ms = Math.round(performance.now() - start)
                const ok = res.ok && raw?.ok !== false
                debugLog(`${ok ? '✓' : '✗'} ${method} ${path} (${ms}ms)`, raw)
                setResults((r) => ({ ...r, [key]: { ok, raw, ms } }))
                return { ok, raw, ms }
            } catch (err: any) {
                const ms = Math.round(performance.now() - start)
                debugLog(`✗ ${method} ${path} threw (${ms}ms)`, err)
                setResults((r) => ({ ...r, [key]: { ok: false, raw: { error: err?.message ?? 'network error' }, ms } }))
                return { ok: false, raw: { error: err?.message }, ms }
            } finally {
                inFlightRef.current = false
                setBusy(null)
            }
        },
        [harnessSecret]
    )

    const refreshWhoami = useCallback(async () => {
        if (!userId) return
        const r = await call('whoami', '/dev/cheats/whoami', { userId }, 'GET')
        if (r.ok) setWhoami(r.raw)
    }, [userId, call])

    useEffect(() => {
        if (userId) refreshWhoami()
    }, [userId, refreshWhoami])

    if (isFetchingUser) return <div className="p-4 font-mono text-sm">loading user…</div>
    if (!userId) {
        return (
            <div className="flex min-h-screen flex-col">
                <NavHeader title="Debug" />
                <div className="p-6">
                    <p className="font-mono text-sm">
                        Not signed in. Sign up via{' '}
                        <a className="underline" href="/setup">
                            /setup
                        </a>{' '}
                        first, then come back.
                    </p>
                </div>
            </div>
        )
    }

    const sections: DebugSection[] = [
        {
            title: '🚀 Presets — one click, full chain',
            actions: [
                {
                    key: 'fullSetup',
                    label: 'Full setup → activated user',
                    description:
                        'KYC bridge + manteca + sumsub, grant Rain card access, fund $5 real testnet USDC (Peanut wallet), fund $5 real testnet USDCR (Rain card collateral — different ERC-20), simulate $25 Bridge sandbox deposit (synthetic — no chain movement), complete every PROCESSING intent. After this you should see activationStep=completed, identity verification cleared, and /card routing to AddCardEntryScreen.',
                    run: async () => {
                        await call('fullSetup', '/dev/cheats/full-setup', { userId })
                        await refreshWhoami()
                    },
                },
                {
                    key: 'autoComplete',
                    label: 'Complete every pending intent',
                    description:
                        'Find every PROCESSING TransactionIntent for me and run the matching impersonator (Bridge ONRAMP/OFFRAMP). Use this to flush stuck transfers from a previous session.',
                    run: async () => {
                        await call('autoComplete', '/dev/cheats/auto-complete-pending', { userId })
                        await refreshWhoami()
                    },
                },
                {
                    key: 'kycAll',
                    label: 'Approve KYC everywhere',
                    description:
                        'Bridge (US) + Manteca (AR) + Sumsub (US) in sequence. Use after signup if Full setup is too aggressive (no funding, no deposit simulation).',
                    run: async () => {
                        await call('kycAllBridge', '/dev/cheats/approve-kyc', {
                            userId,
                            provider: 'bridge',
                            country: 'US',
                        })
                        await call('kycAllManteca', '/dev/cheats/approve-kyc', {
                            userId,
                            provider: 'manteca',
                            country: 'AR',
                        })
                        await call('kycAllSumsub', '/dev/cheats/approve-kyc', {
                            userId,
                            provider: 'sumsub',
                            country: 'US',
                        })
                        await refreshWhoami()
                    },
                },
            ],
        },
        {
            title: '💰 Funding',
            actions: [
                {
                    key: 'fund10',
                    label: 'Send me $10 USDC',
                    description: 'Harness EOA → my Peanut SA on Arb Sepolia.',
                    run: () => call('fund10', '/dev/cheats/fund-sa', { userId, usdc: '10000000' }),
                },
                {
                    key: 'fund25',
                    label: 'Send me $25 USDC',
                    description: 'Mid-size top-up — covers a few QR payments.',
                    run: () => call('fund25', '/dev/cheats/fund-sa', { userId, usdc: '25000000' }),
                },
                {
                    key: 'fund100',
                    label: 'Send me $100 USDC',
                    description: 'Bigger top-up for multi-transaction testing.',
                    run: () => call('fund100', '/dev/cheats/fund-sa', { userId, usdc: '100000000' }),
                },
                {
                    key: 'simBridge25',
                    label: 'Simulate Bridge $25 deposit',
                    description:
                        'Requires Bridge KYC. Fires sandbox simulate_deposit on the VA. Does NOT advance the intent — pair with "Complete every pending intent" or use Full setup.',
                    run: () =>
                        call('simBridge25', '/dev/cheats/simulate-bridge-deposit', { userId, amountUsd: '25.00' }),
                },
            ],
        },
        {
            title: '🪪 KYC (per-provider)',
            actions: [
                {
                    key: 'kycBridge',
                    label: 'Approve KYC · Bridge · US',
                    description: 'Real Bridge sandbox customer + activates US rails (ACH/Wire).',
                    run: () =>
                        call('kycBridge', '/dev/cheats/approve-kyc', { userId, provider: 'bridge', country: 'US' }),
                },
                {
                    key: 'kycBridgeEU',
                    label: 'Approve KYC · Bridge · EU',
                    description: 'Real Bridge customer with EU rails (SEPA).',
                    run: () =>
                        call('kycBridgeEU', '/dev/cheats/approve-kyc', { userId, provider: 'bridge', country: 'DE' }),
                },
                {
                    key: 'kycManteca',
                    label: 'Approve KYC · Manteca · AR',
                    description:
                        'Binds to MANTECA_TEST_ACTIVE_USER_ID (pre-provisioned ACTIVE sandbox user). Manteca sandbox has no synthetic-activation endpoint.',
                    run: () =>
                        call('kycManteca', '/dev/cheats/approve-kyc', { userId, provider: 'manteca', country: 'AR' }),
                },
                {
                    key: 'kycSumsub',
                    label: 'Create Sumsub applicant',
                    description: 'Real Sumsub sandbox applicant. Seeds user_kyc_verifications row.',
                    run: () =>
                        call('kycSumsub', '/dev/cheats/approve-kyc', { userId, provider: 'sumsub', country: 'US' }),
                },
            ],
        },
        {
            title: '💳 Card',
            actions: [
                {
                    key: 'grantCardAccess',
                    label: 'Grant Rain card access',
                    description:
                        'Sets users.card_access_granted_at so /card returns hasCardAccess=true and routes me into AddCardEntryScreen. Bypasses the Pioneer purchase gate.',
                    run: async () => {
                        await call('grantCardAccess', '/dev/cheats/grant-card-access', { userId })
                        await refreshWhoami()
                    },
                },
                {
                    key: 'revokeCardAccess',
                    label: 'Revoke Rain card access',
                    description: 'Clears users.card_access_granted_at so /card falls back to the Pioneer paywall.',
                    run: async () => {
                        await call('revokeCardAccess', '/dev/cheats/grant-card-access', { userId, revoke: true })
                        await refreshWhoami()
                    },
                },
                {
                    key: 'fundRainCollateral',
                    label: 'Fund me $5 Rain USDCR (collateral)',
                    description:
                        'Real on-chain transfer of Rain testnet USDCR (RAIN_TOKEN_ADDRESS) from harness EOA → my SA. Different ERC-20 from the Peanut wallet USDC — auto-balancer reads/transfers this token on card spend, so the SA must hold it for card flows to work end-to-end.',
                    run: () =>
                        call('fundRainCollateral', '/dev/cheats/fund-rain-collateral', {
                            userId,
                            amountMicros: '5000000',
                        }),
                },
            ],
        },
        {
            title: '🌉 Bridge — granular impersonator',
            actions: [
                {
                    key: 'completeBridgeOnramp',
                    label: 'Prompt: complete a specific Bridge ONRAMP',
                    description:
                        'Pastes intent or transfer id. Use the Auto-complete preset instead unless targeting one transfer.',
                    run: async () => {
                        const id = window.prompt('intent or transfer id')
                        if (!id) return
                        return call('completeBridgeOnramp', '/dev/cheats/complete-bridge-onramp', {
                            intentOrTransferId: id,
                        })
                    },
                },
                {
                    key: 'completeBridgeOfframp',
                    label: 'Prompt: complete a specific Bridge OFFRAMP',
                    description: 'Same as above but for offramps.',
                    run: async () => {
                        const id = window.prompt('intent or transfer id')
                        if (!id) return
                        return call('completeBridgeOfframp', '/dev/cheats/complete-bridge-offramp', {
                            intentOrTransferId: id,
                        })
                    },
                },
                {
                    key: 'failBridge',
                    label: 'Prompt: fail a Bridge transfer',
                    description: 'Drives a transfer to terminal error. Pasting intent or transfer id.',
                    run: async () => {
                        const id = window.prompt('intent or transfer id')
                        if (!id) return
                        const reason = window.prompt('reason', 'manual debug failure') ?? 'manual debug failure'
                        return call('failBridge', '/dev/cheats/fail-bridge-transfer', {
                            intentOrTransferId: id,
                            reason,
                        })
                    },
                },
            ],
        },
        {
            title: '🔧 State',
            actions: [
                {
                    key: 'refreshWhoami',
                    label: 'Refresh state panel',
                    description: 'Re-runs whoami. Auto-runs after every preset, but here for ad-hoc.',
                    run: async () => {
                        await refreshWhoami()
                    },
                },
                {
                    key: 'reset',
                    label: '⚠ Reset my provider state',
                    description:
                        'Wipes my Bridge/Manteca customer ids, KYC verifications, and ledger intents. Keeps passkey + user row. Useful when a previous run left bad state.',
                    run: async () => {
                        if (!window.confirm('reset all your provider state? (passkey + user row stay)')) return
                        await call('reset', '/dev/cheats/reset-user', { userId })
                        await refreshWhoami()
                    },
                },
            ],
        },
    ]

    return (
        <div className="flex min-h-screen flex-col">
            <NavHeader title="Debug" />
            <div className="space-y-4 p-4 pb-24">
                <section className="border border-n-1 bg-primary-3 p-3 font-mono text-xs">
                    <div className="mb-2 font-bold">User</div>
                    <div>
                        <b>user_id:</b> <code>{userId}</code>
                    </div>
                    <div>
                        <b>username:</b> <code>{username ?? '(unset)'}</code>
                    </div>
                    <div>
                        <b>api:</b> <code>{PEANUT_API_URL}</code>
                    </div>
                    {whoami && (
                        <>
                            <div className="mt-2 font-bold">Live state (whoami)</div>
                            <div>
                                <b>bridgeKyc:</b> <code>{whoami.bridgeKycStatus ?? '(none)'}</code>{' '}
                                {whoami.hasBridgeCustomerId ? '✓ customer' : '✗ no customer'}
                            </div>
                            <div>
                                <b>manteca:</b> {whoami.hasMantecaUserId ? '✓ user_id bound' : '✗ no user_id'}
                            </div>
                            <div>
                                <b>kycVerifications:</b>{' '}
                                <code>
                                    {whoami.kycVerifications?.length
                                        ? whoami.kycVerifications
                                              .map((v: any) => `${v.provider}=${v.status}`)
                                              .join(', ')
                                        : '(none)'}
                                </code>
                            </div>
                            <div>
                                <b>walletAddresses:</b>{' '}
                                <code className="break-all">
                                    {whoami.walletAddresses?.length ? whoami.walletAddresses.join(', ') : '(none)'}
                                </code>
                            </div>
                        </>
                    )}
                </section>

                {sections.map((section) => (
                    <section key={section.title}>
                        <h2 className="mb-2 font-display text-lg">{section.title}</h2>
                        <div className="space-y-2">
                            {section.actions.map((a) => {
                                const r = results[a.key]
                                const isBusy = busy === a.key
                                return (
                                    <div key={a.key} className="border border-n-1 bg-white p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="font-mono text-sm font-bold">{a.label}</div>
                                                <div className="text-xs text-grey-1">{a.description}</div>
                                            </div>
                                            <Button
                                                variant="purple"
                                                shadowSize="4"
                                                size="small"
                                                onClick={a.run}
                                                disabled={busy !== null}
                                            >
                                                {isBusy ? 'running…' : 'run'}
                                            </Button>
                                        </div>
                                        {r && (
                                            <pre
                                                className={`mt-2 max-h-48 overflow-auto border border-n-1 p-2 text-[10px] leading-tight ${
                                                    r.ok ? 'bg-green-1/30' : 'bg-red-100'
                                                }`}
                                            >
                                                {`(${r.ms}ms) `}
                                                {JSON.stringify(r.raw, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                ))}

                <section className="pt-4">
                    <h2 className="mb-2 font-display text-lg">Shortcuts</h2>
                    <div className="space-y-1 font-mono text-xs">
                        <div>
                            <a className="underline" href="/home">
                                /home
                            </a>{' '}
                            — check balance + activity
                        </div>
                        <div>
                            <a className="underline" href="/history">
                                /history
                            </a>{' '}
                            — full activity feed
                        </div>
                        <div>
                            <a className="underline" href="/add-money">
                                /add-money
                            </a>{' '}
                            — Bridge onramp instructions (after KYC)
                        </div>
                        <div>
                            <a
                                className="underline"
                                href={`${PEANUT_API_URL}/dev/ledger/history?userId=${userId}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                ledger history (raw JSON)
                            </a>
                        </div>
                        <div className="pt-2 text-grey-1">
                            All actions also fire <code>console.log</code> in pink. Pop open DevTools to follow along.
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
