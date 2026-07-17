'use client'
import { type FC, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import posthog from 'posthog-js'
import { useHaptic } from 'use-haptic'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import ProfileMenuItem from '@/components/Profile/components/ProfileMenuItem'
import { Icon } from '@/components/Global/Icons/Icon'
import InfoCard from '@/components/Global/InfoCard'
import { useToast } from '@/components/0_Bruddle/Toast'
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
    const t = useTranslations('card.yourCard')
    const [autoRenewDismissed, setAutoRenewDismissed] = useState(false)
    const [action, setAction] = useQueryState('action', parseAsStringEnum<CardAction>(['lock', 'unlock', 'cancel']))
    const { revealed, isLoading: isRevealing, error: revealError, toggle } = useCardReveal({ cardId: card.id })
    const walletPlatform = useWalletPlatform()
    const walletLabel =
        walletPlatform === 'android' ? t('addToGoogleWallet') : walletPlatform === 'ios' ? t('addToAppleWallet') : null
    const { triggerHaptic } = useHaptic()
    const toast = useToast()

    const isLocked = card.status === 'LOCKED'
    const closeAction = () => void setAction(null)
    const showAutoRenew = !autoRenewDismissed && shouldShowAutoRenewBanner(card.expiryMonth, card.expiryYear)
    const daysLeft = daysUntilExpiry(card.expiryMonth, card.expiryYear)

    const handleCopy = useCallback(
        (value: string, field: 'pan' | 'cvv') => {
            // Fire-and-forget; the util captures failures to Sentry.
            void copyTextToClipboardWithFallback(value)
            triggerHaptic()
            toast.success(field === 'pan' ? t('cardNumberCopied') : t('cvvCopied'))
        },
        [triggerHaptic, toast, t]
    )

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />

            <CardFace
                last4={card.last4}
                isLocked={isLocked}
                revealed={revealed}
                loading={isRevealing}
                error={revealError}
                onToggleReveal={isLocked || isRevealing ? undefined : toggle}
                onCopy={handleCopy}
            />

            {showAutoRenew && (
                <div className="flex items-start gap-3 rounded-sm border border-n-1 bg-white p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-yellow-1">
                        <Icon name="credit-card" size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="font-bold text-n-1">{t('autoRenewTitle')}</div>
                        <div className="text-sm text-grey-1">{t('autoRenewBody', { days: daysLeft })}</div>
                    </div>
                    <button
                        type="button"
                        aria-label={t('dismiss')}
                        onClick={() => setAutoRenewDismissed(true)}
                        className="p-1"
                    >
                        <Icon name="chevron-up" size={16} className="rotate-45" />
                    </button>
                </div>
            )}

            <InfoCard
                variant="info"
                icon="credit-card"
                title={t('payAsCreditTitle')}
                description={t('payAsCreditBody')}
            />

            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-n-1">{t('managementTitle')}</h2>
                <div>
                    <ProfileMenuItem icon="more-horizontal" label={t('pin')} href="/card/pin" position="first" />
                    <ProfileMenuItem icon="meter" label={t('spendingLimit')} href="/card/limit" position="middle" />
                    <ProfileMenuItem
                        icon="credit-card"
                        label={t('physicalCard')}
                        href="/card/physical"
                        position={walletLabel ? 'middle' : 'last'}
                    />
                    {walletLabel && (
                        <ProfileMenuItem icon="wallet" label={walletLabel} href="/card/add-to-wallet" position="last" />
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-base font-bold text-n-1">{t('redZone')}</h2>
                <div>
                    <ProfileMenuItem
                        icon="lock"
                        label={isLocked ? t('unlockCard') : t('lockCard')}
                        onClick={() => {
                            posthog.capture(ANALYTICS_EVENTS.CARD_LOCK_OPENED, {
                                mode: isLocked ? 'unlock' : 'lock',
                            })
                            void setAction(isLocked ? 'unlock' : 'lock')
                        }}
                        href="/dummy"
                        position="first"
                    />
                    <ProfileMenuItem
                        icon="trash"
                        label={t('cancelCard')}
                        onClick={() => {
                            posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_OPENED)
                            void setAction('cancel')
                        }}
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
