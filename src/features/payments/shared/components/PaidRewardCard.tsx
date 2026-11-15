'use client'

import type { Ref } from 'react'
import GlobalCard from '@/components/Global/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { formatFiniteDisplay } from '@/utils/currency'
import type { PaidReward } from '@/features/payments/flows/qr-pay/paidReward'

/** The sponsored amount as the reward lines print it: two decimals, no grouping. */
function sponsoredAmount(reward: PaidReward | null): string | null {
    const amount = reward?.perk?.amountSponsored
    if (!amount || typeof amount !== 'number') return null
    return formatFiniteDisplay(amount, 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
    })
}

/**
 * The QR reward of a paid payment, on its success screen: before the hold, the card that says a
 * reward was earned and to hold to claim it; once revealed, the banner that names it and invites
 * friends. One card for every screen that shows the reward (a merchant QR payment, a Pix send).
 */
export function PaidRewardCard({
    reward,
    revealed,
    cardRef,
}: {
    reward: PaidReward | null
    revealed: boolean
    /** The confetti's origin while the reward waits for its hold. */
    cardRef?: Ref<HTMLDivElement>
}) {
    const t = useAppTranslations('qrPay')
    const amount = sponsoredAmount(reward)

    if (revealed) {
        return (
            <GlobalCard className="flex items-start gap-3 bg-background-default p-4">
                <IconBubble {...CONCEPT_ICONS.rewards} size="m" />
                <div className="flex flex-col gap-2">
                    <h2 className="text-heading-s">{t('success.earnedRewardTitle')}</h2>
                    <p className="text-body-m">
                        {amount ? t('success.earnedInviteFriends', { amount }) : t('success.inviteFriends')}
                    </p>
                </div>
            </GlobalCard>
        )
    }

    return (
        <GlobalCard ref={cardRef} className="flex items-start gap-3 bg-background-default p-4">
            <IconBubble {...CONCEPT_ICONS.rewards} size="m" />
            <div className="flex flex-col gap-2">
                <h2 className="text-heading-card">{t('success.earnedRewardTitle')}</h2>
                <p className="text-body-s">
                    {amount ? t('success.earnedHoldToClaim', { amount }) : t('success.holdToClaim')}
                </p>
            </div>
        </GlobalCard>
    )
}
