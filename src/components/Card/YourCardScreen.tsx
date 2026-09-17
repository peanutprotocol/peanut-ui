'use client'
import { type FC, useCallback, useState } from 'react'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useToast } from '@/components/0_Bruddle/Toast'
import CardFace, { type CopyableCardField } from '@/components/Card/CardFace'
import CancelCardModal from '@/components/Card/CancelCardModal'
import LockCardModal from '@/components/Card/LockCardModal'
import { shouldShowAutoRenewBanner, daysUntilExpiry } from '@/components/Card/cardExpiry.utils'
import { useCardReveal } from '@/hooks/useCardReveal'
import { usePushProvisioning } from '@/hooks/usePushProvisioning'
import { useWalletPlatform } from '@/hooks/useWalletPlatform'
import { cardBalanceDueCents } from '@/utils/balance.utils'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'

type CardAction = 'lock' | 'unlock' | 'cancel'

interface Props {
    overview: RainCardOverview
    card: RainCardSummary
    onPrev?: () => void
}

const COPIED_MESSAGE_KEY: Record<CopyableCardField, 'cardNumberCopied' | 'expiryCopied' | 'cvvCopied'> = {
    pan: 'cardNumberCopied',
    expiry: 'expiryCopied',
    cvv: 'cvvCopied',
}

const YourCardScreen: FC<Props> = ({ overview, card, onPrev }) => {
    const t = useTranslations('card.yourCard')
    const router = useRouter()
    const [autoRenewDismissed, setAutoRenewDismissed] = useState(false)
    const [action, setAction] = useState<CardAction | null>(null)
    const { revealed, isLoading: isRevealing, error: revealError, toggle } = useCardReveal({ cardId: card.id })
    const walletPlatform = useWalletPlatform()
    const walletLabel =
        walletPlatform === 'android' ? t('addToGoogleWallet') : walletPlatform === 'ios' ? t('addToAppleWallet') : null
    const { triggerHaptic } = useAppHaptic()
    const toast = useToast()
    const { nativeAvailable, isAdding, addToWallet } = usePushProvisioning({ id: card.id, last4: card.last4 })

    const handleAddToWallet = useCallback(async () => {
        if (isAdding) return
        const result = await addToWallet()
        if (result.added) {
            triggerHaptic()
            toast.success(t('walletAddSuccess'))
        } else if (!result.canceled && !result.alreadyInWallet) {
            // already in wallet is not a failure
            toast.error(t('walletAddFailed'))
        }
    }, [isAdding, addToWallet, triggerHaptic, toast, t])

    const isLocked = card.status === 'LOCKED'
    const closeAction = () => setAction(null)
    const showAutoRenew = !autoRenewDismissed && shouldShowAutoRenewBanner(card.expiryMonth, card.expiryYear)
    const daysLeft = daysUntilExpiry(card.expiryMonth, card.expiryYear)
    const balanceDueCents = cardBalanceDueCents(overview.balance?.spendingPower)

    const handleCopy = useCallback(
        (_value: string, field: CopyableCardField) => {
            triggerHaptic()
            toast.success(t(COPIED_MESSAGE_KEY[field]))
        },
        [triggerHaptic, toast, t]
    )

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />

            {revealError && <Notification priority="error">{revealError}</Notification>}

            <CardFace
                last4={card.last4}
                isLocked={isLocked}
                revealed={revealed}
                loading={isRevealing}
                onToggleReveal={isLocked || isRevealing ? undefined : toggle}
                onCopy={handleCopy}
            />

            {showAutoRenew && (
                <Notification
                    priority="attention"
                    title={t('autoRenewTitle')}
                    onDismiss={() => setAutoRenewDismissed(true)}
                >
                    {t('autoRenewBody', { days: daysLeft })}
                </Notification>
            )}

            {balanceDueCents > 0 && (
                <Notification
                    priority="attention"
                    title={t('balanceDueTitle', { amount: `$${(balanceDueCents / 100).toFixed(2)}` })}
                >
                    {t('balanceDueBody')}
                </Notification>
            )}

            <Notification priority="info" title={t('payAsCreditTitle')}>
                {t('payAsCreditBody')}
            </Notification>

            <div className="flex flex-col gap-4">
                <Section title={t('managementTitle')}>
                    <ListGroup>
                        <ListItem
                            title={t('pin')}
                            leading={<Icon name="more-horizontal" size={24} />}
                            chevron
                            onClick={() => router.push('/card/pin')}
                        />
                        <ListItem
                            title={t('spendingLimit')}
                            leading={<Icon name="meter" size={24} />}
                            chevron
                            onClick={() => router.push('/card/limit')}
                        />
                        <ListItem
                            title={t('physicalCard')}
                            leading={<Icon name="credit-card" size={24} />}
                            chevron
                            onClick={() => router.push('/card/physical')}
                        />
                        {walletLabel &&
                            // use native provisioning when it is available
                            (nativeAvailable ? (
                                <ListItem
                                    title={walletLabel}
                                    leading={<Icon name="wallet" size={24} />}
                                    chevron
                                    onClick={() => void handleAddToWallet()}
                                />
                            ) : (
                                <ListItem
                                    title={walletLabel}
                                    leading={<Icon name="wallet" size={24} />}
                                    chevron
                                    onClick={() => router.push('/card/add-to-wallet')}
                                />
                            ))}
                    </ListGroup>
                </Section>

                <Section title={t('redZone')}>
                    <ListGroup>
                        <ListItem
                            title={isLocked ? t('unlockCard') : t('lockCard')}
                            leading={<Icon name="lock" size={24} />}
                            chevron
                            onClick={() => {
                                posthog.capture(ANALYTICS_EVENTS.CARD_LOCK_OPENED, {
                                    mode: isLocked ? 'unlock' : 'lock',
                                })
                                setAction(isLocked ? 'unlock' : 'lock')
                            }}
                        />
                        <ListItem
                            title={t('cancelCard')}
                            leading={<Icon name="trash" size={24} />}
                            chevron
                            onClick={() => {
                                posthog.capture(ANALYTICS_EVENTS.CARD_CANCEL_OPENED)
                                setAction('cancel')
                            }}
                        />
                    </ListGroup>
                </Section>
            </div>

            <LockCardModal
                cardId={card.id}
                mode={action === 'unlock' ? 'unlock' : 'lock'}
                isOpen={action === 'lock' || action === 'unlock'}
                onClose={closeAction}
            />
            <CancelCardModal cardId={card.id} isOpen={action === 'cancel'} onClose={closeAction} />
        </PageStack>
    )
}

export default YourCardScreen
