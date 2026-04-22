'use client'

/**
 * Dev Cheats — hand-operated test panel.
 *
 * Wraps the peanut-api-ts `/dev/cheats/*` endpoints, which themselves
 * delegate to the Nutcracker harness library (`engineering/qa/lib/*`)
 * so there's one source of truth for "fund an SA" / "seed a Bridge
 * customer" / "bind a Manteca user" logic.
 *
 * Only mounts in non-prod (DevLayout gate). All endpoints require the
 * TEST_HARNESS_SECRET header — pulled from
 * NEXT_PUBLIC_TEST_HARNESS_SECRET for local dev only.
 */

import { useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { PEANUT_API_URL } from '@/constants/general.consts'

type ActionResult = { ok: boolean; raw: any }

export default function DevCheatsPage() {
    const { user, isFetchingUser } = useAuth()
    const [busy, setBusy] = useState<string | null>(null)
    const [results, setResults] = useState<Record<string, ActionResult>>({})

    const userId = user?.user?.userId ?? null
    const username = user?.user?.username ?? null

    // NEXT_PUBLIC_* is inlined at build time — empty means the harness secret
    // wasn't configured for this build. Page is gated by dev/layout.tsx to
    // sandbox/dev domains, so missing env disables the panel rather than
    // leaking a dev literal into shipped JS.
    const harnessSecret = process.env.NEXT_PUBLIC_TEST_HARNESS_SECRET ?? ''

    const call = async (key: string, path: string, body?: object, method: 'GET' | 'POST' = 'POST') => {
        setBusy(key)
        try {
            const url = method === 'GET' && body
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
            setResults((r) => ({ ...r, [key]: { ok: res.ok && raw?.ok !== false, raw } }))
        } catch (err: any) {
            setResults((r) => ({ ...r, [key]: { ok: false, raw: { error: err?.message ?? 'network error' } } }))
        } finally {
            setBusy(null)
        }
    }

    if (isFetchingUser) return <div className="p-4 font-mono text-sm">loading user…</div>
    if (!userId) {
        return (
            <div className="flex min-h-screen flex-col">
                <NavHeader title="Dev Cheats" />
                <div className="p-6">
                    <p className="font-mono text-sm">
                        Not signed in. Sign up via <a className="underline" href="/setup">/setup</a> first, then come back.
                    </p>
                </div>
            </div>
        )
    }

    const actions: Array<{
        key: string
        label: string
        description: string
        run: () => Promise<void>
    }> = [
        {
            key: 'whoami',
            label: 'Load current state',
            description: 'Show KYC status, wallet addresses, provider IDs for this user.',
            run: () => call('whoami', '/dev/cheats/whoami', { userId }, 'GET'),
        },
        {
            key: 'fund10',
            label: 'Send me $10 USDC',
            description: 'Harness EOA → your Peanut smart account on Arb Sepolia.',
            run: () => call('fund10', '/dev/cheats/fund-sa', { userId, usdc: '10000000' }),
        },
        {
            key: 'fund100',
            label: 'Send me $100 USDC',
            description: 'Bigger top-up for multi-transaction testing.',
            run: () => call('fund100', '/dev/cheats/fund-sa', { userId, usdc: '100000000' }),
        },
        {
            key: 'kycBridge',
            label: 'Approve KYC (Bridge · US)',
            description: 'Creates a real Bridge sandbox customer + activates US rails.',
            run: () => call('kycBridge', '/dev/cheats/approve-kyc', { userId, provider: 'bridge', country: 'US' }),
        },
        {
            key: 'kycBridgeEU',
            label: 'Approve KYC (Bridge · EU)',
            description: 'Real Bridge customer with EU rails (SEPA).',
            run: () => call('kycBridgeEU', '/dev/cheats/approve-kyc', { userId, provider: 'bridge', country: 'DE' }),
        },
        {
            key: 'kycManteca',
            label: 'Approve KYC (Manteca · AR)',
            description: 'Binds to pre-provisioned ACTIVE sandbox user + seeds MANTECA kyc_verifications row.',
            run: () => call('kycManteca', '/dev/cheats/approve-kyc', { userId, provider: 'manteca', country: 'AR' }),
        },
        {
            key: 'kycSumsub',
            label: 'Create Sumsub applicant',
            description: 'Real Sumsub sandbox applicant. Seeds user_kyc_verifications.',
            run: () => call('kycSumsub', '/dev/cheats/approve-kyc', { userId, provider: 'sumsub', country: 'US' }),
        },
        {
            key: 'simBridge25',
            label: 'Simulate Bridge deposit ($25)',
            description: 'Requires Bridge KYC first. Fires sandbox simulate_deposit on the virtual account.',
            run: () => call('simBridge25', '/dev/cheats/simulate-bridge-deposit', { userId, amountUsd: '25.00' }),
        },
        {
            key: 'reset',
            label: '⚠ Reset my provider state',
            description: 'Deletes bridge/manteca transfers, KYC verifications, ledger intents for you only. Keeps passkey + user row.',
            run: () => call('reset', '/dev/cheats/reset-user', { userId }),
        },
    ]

    return (
        <div className="flex min-h-screen flex-col">
            <NavHeader title="Dev Cheats" />
            <div className="p-4 space-y-4 pb-24">
                <section className="border border-n-1 bg-primary-3 p-3 font-mono text-xs">
                    <div>
                        <b>user_id:</b> <code>{userId}</code>
                    </div>
                    <div>
                        <b>username:</b> <code>{username ?? '(unset)'}</code>
                    </div>
                    <div>
                        <b>api:</b> <code>{PEANUT_API_URL}</code>
                    </div>
                </section>

                <section>
                    <h2 className="mb-2 font-display text-lg">Cheats</h2>
                    <div className="space-y-2">
                        {actions.map((a) => {
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
                                            disabled={isBusy}
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
                                            {JSON.stringify(r.raw, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section className="pt-4">
                    <h2 className="mb-2 font-display text-lg">Shortcuts</h2>
                    <div className="space-y-1 font-mono text-xs">
                        <div>
                            <a className="underline" href="/home">
                                /home
                            </a>{' '}
                            — check balance after funding
                        </div>
                        <div>
                            <a className="underline" href="/history">
                                /history
                            </a>{' '}
                            — should show token_transfers from fund-sa
                        </div>
                        <div>
                            <a className="underline" href="/add-money">
                                /add-money
                            </a>{' '}
                            — after Bridge KYC, onramp should render bank instructions
                        </div>
                        <div>
                            <a
                                className="underline"
                                href={`http://127.0.0.1:5050/dev/ledger/history?userId=${userId}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                /dev/ledger/history?userId=…
                            </a>{' '}
                            — shadow-read of ledger intents (raw JSON)
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
