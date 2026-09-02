'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import BalanceWarningModal from '@/components/Global/BalanceWarningModal'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import { CancelDepositActions } from '@/components/TransactionDetails/provider-actions/CancelDepositActions'
import { PasskeySetupHelpModal } from '@/components/Setup/Views/PasskeySetupHelpModal'
import PublicProfile from '@/components/Profile/components/PublicProfile'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import DevNoteCard from '../_components/DevNoteCard'
import DevPageShell from '../_components/DevPageShell'

// temporary review page for TASK-21904 — every modal→drawer preview conversion
// and all its reachable states in one place, real components, mock props.
// delete after the keep/change decision lands.

// pending bridge onramp: hits the generic "cancel deposit" branch
const bridgeOnrampTx = {
    id: 'dev-onramp-1',
    direction: 'bank_deposit',
    status: 'pending',
    extraDataForDrawer: { depositInstructions: { deposit_message: 'DEVREF1234' } },
} as unknown as TransactionDetails

// pending bank request as sender: hits the "cancel deposit request" branch
const bankRequestTx = {
    id: 'dev-request-1',
    direction: 'bank_deposit',
    status: 'pending',
    extraDataForDrawer: { originalUserRole: 'SENDER', bridgeTransferId: 'dev-bridge-1' },
} as unknown as TransactionDetails

type DepositVariant = 'bridge' | 'request' | 'inflight'
type PasskeyVariant = { errorName: string; platform: 'android' | 'ios' | 'web' }

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-2 border-b border-border-default pb-4">
            <h2 className="text-heading-card">{title}</h2>
            <p className="text-body-s text-foreground-secondary">{note}</p>
            <div className="flex flex-wrap items-start gap-2">{children}</div>
        </section>
    )
}

export default function DrawerPreviewPage() {
    // 1. cancel send link
    const [cancelLinkOpen, setCancelLinkOpen] = useState(false)
    const [cancelLinkLoading, setCancelLinkLoading] = useState(false)

    // 2. cancel deposit
    const [depositVariant, setDepositVariant] = useState<DepositVariant>('bridge')
    const [depositLoading, setDepositLoading] = useState(false)

    // 3. passkey help (stayed a modal)
    const [passkeyVariant, setPasskeyVariant] = useState<PasskeyVariant | null>(null)

    // 4. public profile invite gate
    const [showGuestProfile, setShowGuestProfile] = useState(false)

    // 5. balance warning
    const [balanceOpen, setBalanceOpen] = useState(false)

    // 6. onramp confirmation
    const [onrampVariant, setOnrampVariant] = useState<{ amount: string; currency: string } | null>(null)

    return (
        <DevPageShell
            title="drawer preview"
            description="TASK-21904 modal→drawer conversions — real components, mock props, one trigger per reachable state."
            width="prose"
        >
            <div className="flex flex-col gap-6">
                <Section
                    title="1. CancelSendLinkDrawer"
                    note="was CancelSendLinkModal — already shipped as a nested-capable drawer before this task; single simple CTA, no competing button animations. confirm mock runs ~2s in-flight (drawer locks non-dismissible) then closes."
                >
                    <Button variant="stroke" onClick={() => setCancelLinkOpen(true)}>
                        open (idle → in-flight on confirm)
                    </Button>
                </Section>

                <Section
                    title="2. CancelDepositActions"
                    note="confirm ActionModal (z-index-hacked) → drawer. the component renders its own trigger button below; the confirm drawer opens from it. pick a variant first."
                >
                    <Button
                        variant={depositVariant === 'bridge' ? 'purple' : 'stroke'}
                        onClick={() => setDepositVariant('bridge')}
                    >
                        bridge deposit
                    </Button>
                    <Button
                        variant={depositVariant === 'request' ? 'purple' : 'stroke'}
                        onClick={() => setDepositVariant('request')}
                    >
                        bank request
                    </Button>
                    <Button
                        variant={depositVariant === 'inflight' ? 'purple' : 'stroke'}
                        onClick={() => setDepositVariant('inflight')}
                    >
                        in-flight (disabled button)
                    </Button>
                    <div className="w-full">
                        <CancelDepositActions
                            transaction={depositVariant === 'request' ? bankRequestTx : bridgeOnrampTx}
                            isPendingBankRequest={depositVariant === 'request'}
                            isLoading={depositVariant === 'inflight' || depositLoading}
                            setIsLoading={setDepositLoading}
                            onClose={() => setDepositLoading(false)}
                        />
                    </div>
                    <DevNoteCard>
                        confirming inside the drawer really calls the cancel api with the fake id above — it fails and
                        surfaces the error Notification, which doubles as the error-state preview.
                    </DevNoteCard>
                </Section>

                <Section
                    title="3. PasskeySetupHelpModal — stayed a MODAL"
                    note="was converted, then reverted with the setup-flow handover — shown as-is for side-by-side comparison with the drawers."
                >
                    <Button
                        variant="stroke"
                        onClick={() => setPasskeyVariant({ errorName: 'NotAllowedError', platform: 'android' })}
                    >
                        android · not allowed (with warning)
                    </Button>
                    <Button
                        variant="stroke"
                        onClick={() => setPasskeyVariant({ errorName: 'unknown', platform: 'web' })}
                    >
                        web · default
                    </Button>
                </Section>

                <Section
                    title="4. PublicProfile invite-unavailable"
                    note="ActionModal → informational drawer, inline in PublicProfile. mount the guest profile, then tap Request to open the guest crediting door."
                >
                    <Button variant="stroke" onClick={() => setShowGuestProfile((v) => !v)}>
                        {showGuestProfile ? 'unmount guest profile' : 'mount guest profile'}
                    </Button>
                    {showGuestProfile && (
                        <div className="w-full rounded-sm border border-border-default p-4">
                            <PublicProfile username="satoshi" isLoggedIn={false} />
                        </div>
                    )}
                    <DevNoteCard>
                        the logged-in-without-access variant (beg-for-invite ShareButton) is not reachable here — it
                        needs a real authed user with hasAppAccess=false. also: tapping the join CTA runs the real
                        invite-code flow and navigates away.
                    </DevNoteCard>
                </Section>

                <Section
                    title="5. BalanceWarningModal"
                    note="centered forced modal → non-dismissible drawer with the built-in scroll area. only the slide exits — swipe, overlay and hardware back are no-ops. platform link copy is auto-detected from the user agent, so there is one variant per device."
                >
                    <Button variant="stroke" onClick={() => setBalanceOpen(true)}>
                        open (slide to exit)
                    </Button>
                </Section>

                <Section
                    title="6. OnrampConfirmationModal (IMPORTANT!)"
                    note="bank-deposit confirm modal → drawer, SlideToConfirm kept as the CTA inside a data-vaul-no-drag wrapper. two copy lengths via amount/currency."
                >
                    <Button
                        variant="stroke"
                        onClick={() => setOnrampVariant({ amount: '1,250,000.00', currency: 'ARS' })}
                    >
                        ARS · long amount
                    </Button>
                    <Button variant="stroke" onClick={() => setOnrampVariant({ amount: '50.00', currency: 'EUR' })}>
                        EUR · short amount
                    </Button>
                </Section>
            </div>

            {/* the components under review */}
            <CancelSendLinkDrawer
                showCancelLinkDrawer={cancelLinkOpen}
                setShowCancelLinkDrawer={setCancelLinkOpen}
                amount="$25.00"
                isLoading={cancelLinkLoading}
                onClick={async () => {
                    // mock in-flight: hold the loading state so the non-dismissible lock is visible
                    setCancelLinkLoading(true)
                    await new Promise((resolve) => setTimeout(resolve, 2000))
                    setCancelLinkLoading(false)
                    setCancelLinkOpen(false)
                }}
            />

            {passkeyVariant && (
                <PasskeySetupHelpModal
                    visible
                    onClose={() => setPasskeyVariant(null)}
                    onRetry={() => setPasskeyVariant(null)}
                    errorName={passkeyVariant.errorName}
                    platform={passkeyVariant.platform}
                />
            )}

            <BalanceWarningModal visible={balanceOpen} onCloseAction={() => setBalanceOpen(false)} />

            {onrampVariant && (
                <OnrampConfirmationModal
                    visible
                    onClose={() => setOnrampVariant(null)}
                    onConfirm={() => setOnrampVariant(null)}
                    amount={onrampVariant.amount}
                    currency={onrampVariant.currency}
                />
            )}
        </DevPageShell>
    )
}
