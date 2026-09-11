'use client'

import { DepositAccountsFlow } from '@/features/deposit-accounts/components/DepositAccountsFlow'
import Link from 'next/link'
import { useState } from 'react'
import DevNoteCard from '../_components/DevNoteCard'
import DevPageShell from '../_components/DevPageShell'
import DevPanel from '../_components/DevPanel'
import DevPresetButton from '../_components/DevPresetButton'
import DevSegmented from '../_components/DevSegmented'
import { useSandboxDepositAccounts, type SandboxScenario } from './_components/useSandboxDepositAccounts'

const SCENARIOS: { value: SandboxScenario; label: string; hint: string }[] = [
    { value: 'live', label: 'Live', hint: 'Nothing held until you claim it — the real transition' },
    { value: 'all-claimed', label: 'Claimed', hint: 'Every Bridge corridor already active' },
    { value: 'provisioning', label: 'Setting up', hint: 'The skeleton while the provider works' },
    { value: 'failed', label: 'Failed', hint: 'Provisioning did not complete' },
    { value: 'returned', label: 'Returned', hint: 'A payment came back' },
    { value: 'kyc', label: 'KYC gate', hint: 'Identity not verified yet' },
]

/**
 * Virtual accounts — the get-paid flow on real Bridge sandbox data.
 *
 * The Virtual Accounts SKU is `not_allowed` in production and ungated in
 * sandbox, so every bank detail on these screens is a payload Bridge really
 * returned (captured 2026-09-11). The product decisions behind the flow, and
 * the directions still open, are at /dev/deposit-accounts/directions.
 */
export default function DepositAccountsPrototypePage() {
    const [scenario, setScenario] = useState<SandboxScenario>('live')
    const sandbox = useSandboxDepositAccounts(scenario)

    return (
        <DevPageShell
            title="Deposit accounts"
            description="Claim bank details in your own name, per region, and hand them to whoever pays you. Real Bridge sandbox payloads through the product adapters."
            actions={
                <Link href="/dev/deposit-accounts/directions" className="text-body-s underline">
                    Product directions
                </Link>
            }
        >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                <aside className="order-last flex w-full flex-col gap-6 lg:order-first lg:max-w-sm">
                    <DevPanel title="Scenario">
                        <div className="overflow-x-auto">
                            <DevSegmented
                                size="sm"
                                value={scenario}
                                options={SCENARIOS}
                                onChange={(next) => {
                                    sandbox.reset()
                                    setScenario(next)
                                }}
                            />
                        </div>
                    </DevPanel>
                    <DevPresetButton onClick={sandbox.reset}>Reset claims</DevPresetButton>
                    <DevNoteCard title="Where the data comes from">
                        Every USD, EUR, GBP and MXN value is a Bridge sandbox response, captured by mono
                        projects/virtual-accounts/capture-sandbox-vas.sh and read through the same adapters a product
                        build would use. Sandbox banks have placeholder names — &quot;Bank of Nowhere&quot; is
                        Bridge&apos;s fixture, not a real correspondent.
                    </DevNoteCard>
                    <DevNoteCard title="What the data decided">
                        GBP comes back in Bridge&apos;s own name while EUR, USD and MXN come back in the
                        customer&apos;s, so whose name a payer reads is per corridor and is derived by comparing the
                        returned holder against the user. No corridor carries a reference. Mexican SPEI returns a CLABE
                        and no bank name at all, so rows follow field presence, never currency.
                    </DevNoteCard>
                    <DevNoteCard title="Argentina and Brazil">
                        Manteca, not Bridge, and not claimable: the Argentine CVU belongs to Sixalime Sas and only
                        credits transfers from an account in the user&apos;s own name, and Brazil mints a Pix code per
                        payment. Both render honestly through the same contract — pooled holder, own-name-only sender —
                        with the share surface off.
                    </DevNoteCard>
                </aside>

                <main className="flex flex-1 flex-col items-center gap-4">
                    <div className="self-stretch rounded-sm border border-border-default bg-background-page p-2 text-center text-body-xs text-foreground-secondary">
                        at phone widths this is the screen itself · screen and corridor live in the URL
                    </div>
                    <div className="w-full bg-background-default lg:max-w-sm lg:overflow-hidden lg:rounded-sm lg:border-2 lg:border-border-default lg:shadow-4">
                        {/* The (mobile-ui) layout strips its px-4 for /dev routes, so the
                            harness has to supply the screen-edge inset itself — otherwise
                            these screens render flush to the frame and look nothing like
                            the app, where AppShell owns that gutter. */}
                        <div className="flex min-h-160 flex-col p-4">
                            <DepositAccountsFlow
                                accounts={sandbox.accounts}
                                userName={sandbox.userName}
                                gate={sandbox.gate}
                                claimingCorridor={sandbox.claimingCorridor}
                                returnedPayment={sandbox.returnedPayment}
                                onClaim={sandbox.claim}
                                onResolveGate={() => setScenario('live')}
                            />
                        </div>
                    </div>
                </main>
            </div>
        </DevPageShell>
    )
}
