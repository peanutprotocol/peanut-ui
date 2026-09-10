'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { type PendingPerk } from '@/services/perks'
import { Icon } from '@/components/Global/Icons/Icon'
import { extractInviteeName } from '@/utils/general.utils'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { useRouter } from 'next/navigation'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useAuth } from '@/context/authContext'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import type { ClaimPhase } from './perkClaim.types'
import { SURPRISE_CLAIM_COUNT_KEY } from './perkClaim.consts'

interface PerkClaimSuccessModalProps {
    perk: PendingPerk
    claimPhase: ClaimPhase
    onClose: () => void
    onDismiss: () => void
}

/**
 * Success modal using ActionModal's native layout for consistent design system styling.
 * Uses icon/title/description props for standard vertical centered layout.
 */
export function PerkClaimSuccessModal({ perk, claimPhase, onClose, onDismiss }: PerkClaimSuccessModalProps) {
    const t = useAppTranslations('home.perk')
    const tCommon = useTranslations('common')
    const inviteeName = perk.inviteeName ?? extractInviteeName(perk.reason)
    const { triggerHaptic } = useAppHaptic()
    const router = useRouter()
    const { user } = useAuth()
    const [canDismiss, setCanDismiss] = useState(false)
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const isExiting = claimPhase === 'exiting'

    // Surprise moment claim count: read synchronously so first render has correct copy.
    // 0=first surprise, 1=second, 2+=normal referral claim.
    // NOTE: stored in localStorage per-user. Cross-device users may see surprise copy again.
    // TODO: move to BE (perk_usage count for surprise campaigns) for authoritative tracking.
    const [claimCount] = useState(() => {
        const prefs = user?.user.userId ? getUserPreferences(user.user.userId) : null
        return prefs?.[SURPRISE_CLAIM_COUNT_KEY] ?? 0
    })
    useEffect(() => {
        if (!user?.user.userId) return
        updateUserPreferences(user.user.userId, { [SURPRISE_CLAIM_COUNT_KEY]: claimCount + 1 })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- fire once on mount

    useEffect(() => {
        triggerHaptic()
        const dismissTimer = setTimeout(() => setCanDismiss(true), 2000)
        return () => clearTimeout(dismissTimer)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps -- triggerHaptic is stable

    const isSurpriseMoment = claimCount < 2

    return (
        <>
            <ActionModal
                visible={true}
                onClose={onClose}
                hideModalCloseButton
                preventClose={isExiting}
                icon="check"
                iconProps={{ className: 'text-white' }}
                iconContainerClassName="bg-background-icon-bubble-green"
                title=""
                description={
                    <div className={isExiting ? 'animate-gift-exit' : 'animate-gift-revealed'}>
                        <p className="text-heading-m text-black">+${perk.amountUsd}</p>
                        {isSurpriseMoment ? (
                            <>
                                {/* Approved copy — see notion: notifs-copy-33083811757980638a27effc79a033f3 */}
                                <p className="mt-2 text-center text-body-m-semibold text-foreground-primary">
                                    {t('surpriseTitle', { amount: perk.amountUsd })}
                                </p>
                                <p className="mt-1 text-center text-body-s text-foreground-secondary">
                                    {claimCount === 0 ? t('surpriseDescriptionFirst') : t('surpriseDescriptionNext')}
                                </p>
                            </>
                        ) : inviteeName ? (
                            <p className="mt-1 flex items-center justify-center gap-1 text-body-s text-foreground-secondary">
                                <Icon name="invite-heart" size={16} />
                                {t.rich('usedPeanut', {
                                    inviteeName,
                                    name: (chunks) => <span className="font-medium">{chunks}</span>,
                                })}
                            </p>
                        ) : (
                            <p className="mt-1 text-body-s text-foreground-secondary">{t('rewardClaimed')}</p>
                        )}
                    </div>
                }
                content={
                    <>
                        <SoundPlayer sound="success" />
                        {canDismiss && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                                {isSurpriseMoment ? (
                                    <>
                                        <Button
                                            variant="purple"
                                            shadowSize="4"
                                            className="w-full"
                                            onClick={() => {
                                                posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                                                    source: REFERRAL_SOURCES.SURPRISE_MOMENT,
                                                })
                                                onDismiss()
                                                setIsInviteModalOpen(true)
                                            }}
                                        >
                                            {t('shareAndEarn')}
                                        </Button>
                                        <Button variant="stroke" className="w-full" onClick={onDismiss}>
                                            {tCommon('maybeLater')}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="purple" shadowSize="4" className="w-full" onClick={onDismiss}>
                                            {tCommon('done')}
                                        </Button>
                                        <Button
                                            variant="stroke"
                                            className="w-full"
                                            onClick={() => {
                                                onDismiss()
                                                router.push('/rewards')
                                            }}
                                        >
                                            {t('inviteFriendsToEarnMore')}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                }
            />
            {user?.user.username && (
                <InviteFriendsModal
                    visible={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    username={user.user.username}
                    source="surprise_moment"
                />
            )}
        </>
    )
}
