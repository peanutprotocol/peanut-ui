'use client'
import { type FC, useState } from 'react'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import NavHeader from '@/components/Global/NavHeader'
import ProfileMenuItem from '@/components/Profile/components/ProfileMenuItem'
import { Icon } from '@/components/Global/Icons/Icon'
import CardFace from '@/components/Card/CardFace'
import CancelCardModal from '@/components/Card/CancelCardModal'
import LockCardModal from '@/components/Card/LockCardModal'
import { shouldShowAutoRenewBanner, daysUntilExpiry } from '@/components/Card/cardExpiry.utils'
import { useCardReveal } from '@/hooks/useCardReveal'
import { useWalletPlatform } from '@/hooks/useWalletPlatform'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

type CardAction = 'lock' | 'unlock' | 'cancel'

interface Props {
    overview: RainCardOverview
    card: RainCardSummary
    onPrev?: () => void
}

const YourCardScreen: FC<Props> = ({ card, onPrev }) => {
    const [autoRenewDismissed, setAutoRenewDismissed] = useState(false)
    const [action, setAction] = useQueryState('action', parseAsStringEnum<CardAction>(['lock', 'unlock', 'cancel']))
    const { revealed, isLoading: isRevealing, error: revealError, toggle } = useCardReveal({ cardId: card.id })
    const walletPlatform = useWalletPlatform()
    const walletLabel =
        walletPlatform === 'android' ? 'Add to Google Wallet' : walletPlatform === 'ios' ? 'Add to Apple Wallet' : null

    const isLocked = card.status === 'LOCKED'
    const closeAction = () => void setAction(null)
    const showAutoRenew = !autoRenewDismissed && shouldShowAutoRenewBanner(card.expiryMonth, card.expiryYear)
    const daysLeft = daysUntilExpiry(card.expiryMonth, card.expiryYear)

    const handleCopy = (value: string) => {
        // Fire-and-forget; the util captures failures to Sentry.
        void copyTextToClipboardWithFallback(value)
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Your card" onPrev={onPrev} />

            <div className="flex flex-col gap-2">
                <CardFace
                    last4={card.last4}
                    isLocked={isLocked}
                    revealed={revealed}
                    onToggleReveal={isLocked || isRevealing ? undefined : toggle}
                    onCopy={handleCopy}
                />
                {isRevealing && <p className="text-center text-sm text-grey-1">Loading card details…</p>}
                {revealError && <p className="text-center text-sm text-red">{revealError}</p>}
            </div>

            {showAutoRenew && (
                <div className="flex items-start gap-3 rounded-sm border border-n-1 bg-white p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-1">
                        <Icon name="credit-card" size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="font-bold text-n-1">Card auto renews soon</div>
                        <div className="text-sm text-grey-1">
                            Your card will automatically renew in {daysLeft} {daysLeft === 1 ? 'day' : 'days'},
                            expiration date will change.
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setAutoRenewDismissed(true)}
                        className="p-1"
                    >
                        <Icon name="chevron-up" size={16} className="rotate-45" />
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-n-1">Card management</h2>
                <div>
                    <ProfileMenuItem icon="more-horizontal" label="Pin" href="/card/pin" position="first" />
                    <ProfileMenuItem icon="meter" label="Spending limit" href="/card/limit" position="middle" />
                    <ProfileMenuItem
                        icon="credit-card"
                        label="Physical card"
                        href="/card/physical"
                        position={walletLabel ? 'middle' : 'last'}
                    />
                    {walletLabel && (
                        <ProfileMenuItem icon="wallet" label={walletLabel} href="/card/add-to-wallet" position="last" />
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-n-1">Red zone</h2>
                <div>
                    <ProfileMenuItem
                        icon="lock"
                        label={isLocked ? 'Unlock card' : 'Lock card'}
                        onClick={() => void setAction(isLocked ? 'unlock' : 'lock')}
                        href="/dummy"
                        position="first"
                    />
                    <ProfileMenuItem
                        icon="trash"
                        label="Cancel card"
                        onClick={() => void setAction('cancel')}
                        href="/dummy"
                        position="last"
                    />
                </div>
            </div>

            <LockCardModal
                cardId={card.id}
                mode={action === 'unlock' ? 'unlock' : 'lock'}
                isOpen={action === 'lock' || action === 'unlock'}
                onClose={closeAction}
            />
            <CancelCardModal cardId={card.id} isOpen={action === 'cancel'} onClose={closeAction} />
        </div>
    )
}

export default YourCardScreen
