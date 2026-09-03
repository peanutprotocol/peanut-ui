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
import { PasskeySetupHelpDrawerPreview } from './PasskeySetupHelpDrawerPreview'

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

type PasskeyVariant = { errorName: string; platform: 'android' | 'ios' | 'web'; surface: 'modal' | 'drawer' }

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
                    note="was CancelSendLinkModal — now the composed destructive-confirm shape: red icon bubble, title + description header, single CTA. confirm mock runs ~2s in-flight (drawer locks non-dismissible) then closes."
                >
                    <Button variant="stroke" onClick={() => setCancelLinkOpen(true)}>
                        open (idle → in-flight on confirm)
                    </Button>
                </Section>

                <Section
                    title="2. CancelDepositActions"
                    note="confirm ActionModal (z-index-hacked) → drawer. the buttons below ARE the real component — each opens its confirm drawer in one tap."
                >
                    {/* one live instance per state — a variant picker here read as dead trigger
                        buttons, so every rendered button now genuinely opens a drawer */}
                    <div className="flex w-full flex-col gap-2">
                        <p className="text-body-xs text-foreground-secondary">
                            bridge deposit → &quot;Cancel this deposit?&quot; drawer
                        </p>
                        <CancelDepositActions
                            transaction={bridgeOnrampTx}
                            isPendingBankRequest={false}
                            isLoading={depositLoading}
                            setIsLoading={setDepositLoading}
                            onClose={() => setDepositLoading(false)}
                        />
                        <p className="text-body-xs text-foreground-secondary">
                            bank request → &quot;Cancel this request?&quot; drawer
                        </p>
                        <CancelDepositActions
                            transaction={bankRequestTx}
                            isPendingBankRequest={true}
                            isLoading={depositLoading}
                            setIsLoading={setDepositLoading}
                            onClose={() => setDepositLoading(false)}
                        />
                        <p className="text-body-xs text-foreground-secondary">
                            in-flight: the trigger disables while a cancel runs (nothing to open here)
                        </p>
                        <CancelDepositActions
                            transaction={bridgeOnrampTx}
                            isPendingBankRequest={false}
                            isLoading={true}
                            setIsLoading={() => {}}
                            onClose={() => {}}
                        />
                    </div>
                    <DevNoteCard>
                        confirming inside the drawer really calls the cancel api with the fake id above — it fails and
                        surfaces the error Notification, which doubles as the error-state preview.
                    </DevNoteCard>
                </Section>

                <Section
                    title="3. PasskeySetupHelpModal"
                    note="preview only — production stays a modal, handed to Slava (#2926 comment). first pair: the shipped modal as-is. second pair: the reverted drawer conversion, rebuilt as a dev-only copy."
                >
                    <div className="flex w-full flex-col gap-2">
                        <p className="text-body-xs text-foreground-secondary">current production modal (as-is):</p>
                        <Button
                            variant="stroke"
                            onClick={() =>
                                setPasskeyVariant({
                                    errorName: 'NotAllowedError',
                                    platform: 'android',
                                    surface: 'modal',
                                })
                            }
                        >
                            modal · android · not allowed
                        </Button>
                        <Button
                            variant="stroke"
                            onClick={() =>
                                setPasskeyVariant({ errorName: 'unknown', platform: 'web', surface: 'modal' })
                            }
                        >
                            modal · web · default
                        </Button>
                        <p className="text-body-xs text-foreground-secondary">
                            drawer variant (preview-only copy, scrollable):
                        </p>
                        <Button
                            variant="stroke"
                            onClick={() =>
                                setPasskeyVariant({
                                    errorName: 'NotAllowedError',
                                    platform: 'android',
                                    surface: 'drawer',
                                })
                            }
                        >
                            drawer · android · not allowed
                        </Button>
                        <Button
                            variant="stroke"
                            onClick={() =>
                                setPasskeyVariant({ errorName: 'unknown', platform: 'web', surface: 'drawer' })
                            }
                        >
                            drawer · web · default
                        </Button>
                    </div>
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
                    note="centered forced modal → non-dismissible drawer, now composed: title + lead line, the two self-custody facts as an info checklist, learn-more footnote. only the slide exits — swipe, overlay and hardware back are no-ops. platform link copy is auto-detected from the user agent."
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

            {passkeyVariant && passkeyVariant.surface === 'modal' && (
                <PasskeySetupHelpModal
                    visible
                    onClose={() => setPasskeyVariant(null)}
                    onRetry={() => setPasskeyVariant(null)}
                    errorName={passkeyVariant.errorName}
                    platform={passkeyVariant.platform}
                />
            )}

            {passkeyVariant && passkeyVariant.surface === 'drawer' && (
                <PasskeySetupHelpDrawerPreview
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
