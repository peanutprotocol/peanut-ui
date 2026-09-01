'use client'

import { useQueryStates } from 'nuqs'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'
import { Button } from '@/components/0_Bruddle/Button'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import DevNoteCard from '../_components/DevNoteCard'
import DevPageShell from '../_components/DevPageShell'
import { VirtualAccountsFlow } from './_components/VirtualAccountsFlow'
import { VA_PARAMS, VA_STATES } from './_components/params'

/**
 * Virtual Accounts prototype — the get-paid flow on Bridge V1 as it is today
 * (memo required, pooled EUR name, off-amount deposits bounce), with the
 * memo fork as a toggle. Mock data, no API, no product route. The spec and
 * the flagged-not-changed list live in mono projects/virtual-accounts/ui-spec.md.
 */
export default function VirtualAccountsPrototypePage() {
    const [{ state, sku }, setParams] = useQueryStates(VA_PARAMS)

    return (
        <DevPageShell
            title="Virtual accounts"
            description="Get-paid flow on Bridge V1: currency picker with the KYC gate, details with the payment reference as a removable slot, and the payer-facing share view. Mock data only."
        >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                <aside className="flex w-full flex-col gap-6 lg:max-w-sm">
                    <Section title="Details state">
                        <SegmentedControl
                            aria-label="Prototype state"
                            fullWidth
                            options={VA_STATES.map((value) => ({ value, label: value }))}
                            value={state}
                            onChange={(value) => setParams({ state: value as (typeof VA_STATES)[number] })}
                        />
                    </Section>
                    <Section title="The memo fork">
                        <ListItem
                            title="Virtual Accounts SKU enabled"
                            body={
                                sku
                                    ? 'No reference, holder is the user, micro-deposits work'
                                    : 'Today: reference required, pooled holder name'
                            }
                            trailing={<Toggle checked={sku} onChange={(checked) => setParams({ sku: checked })} />}
                        />
                    </Section>
                    <Button
                        variant="stroke"
                        onClick={() => setParams({ screen: 'pick', currency: 'eur', state: 'ready', sku: false })}
                    >
                        Reset flow
                    </Button>
                    <DevNoteCard title="What dies when the SKU flips">
                        MemoSlot (the reference card), the pooled-holder notice, the &quot;waiting for a payment?&quot;
                        helper, the reference row and paragraph in the share text. The holder row shows the user&apos;s
                        name. The picker, the KYC gate, the receipt card, the arrival copy and the share surface do not
                        change. The returned-payment state is fixed by peanut-api-ts #1405, not by the SKU.
                    </DevNoteCard>
                    <DevNoteCard title="Mock data">
                        USD and EUR values follow the 2026-08-24 Bridge production PoC (Peanut at Lead Bank; Bridge
                        Building Sp. Z.o.o. at Banking Circle). Account numbers and IBANs are samples. GBP and MXN were
                        not in the PoC: field shapes copy AddMoneyBankDetails, values are placeholders.
                    </DevNoteCard>
                </aside>
                <main className="flex flex-1 flex-col items-center gap-4">
                    <div className="self-stretch rounded-sm border border-border-default bg-background-page p-2 text-center font-mono text-body-xs text-foreground-secondary">
                        at phone widths this is the screen itself (shell inset only); on desktop it sits in a 384px
                        frame · state, screen and currency live in the URL
                    </div>
                    <div className="w-full bg-background-default lg:max-w-sm lg:overflow-hidden lg:rounded-3xl lg:border-2 lg:border-border-default lg:shadow-4">
                        <div className="flex min-h-185 flex-col lg:px-4 lg:py-4">
                            <VirtualAccountsFlow />
                        </div>
                    </div>
                </main>
            </div>
        </DevPageShell>
    )
}
