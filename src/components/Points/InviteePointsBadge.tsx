'use client'

import { useCountUp } from '@/hooks/useCountUp'
import { useTranslations } from 'next-intl'
import { formatPoints } from '@/utils/format.utils'

interface InviteePointsBadgeProps {
    points: number
    inView: boolean
    /** usd earned from this invitee (rewards v2) — shown instead of points when available */
    lifetimeEarnedUsd?: number
}

/** Invitee badge — primary: $ earned, secondary: points. Same stacked pattern as TransactionCard. */
const InviteePointsBadge = ({ points, inView, lifetimeEarnedUsd }: InviteePointsBadgeProps) => {
    const t = useTranslations('rewards')
    const animated = useCountUp(points, { duration: 1.2, enabled: inView })
    const pointsLabel = t('pointsAbbrev', { count: points })

    if (lifetimeEarnedUsd !== undefined && lifetimeEarnedUsd > 0) {
        return (
            <div className="flex flex-col items-end">
                <span className="font-semibold">${lifetimeEarnedUsd.toFixed(2)}</span>
                <span className="text-sm font-medium text-grey-1">
                    +{formatPoints(animated)} {pointsLabel}
                </span>
            </div>
        )
    }

    return (
        <p className="text-grey-1">
            +{formatPoints(animated)} {pointsLabel}
        </p>
    )
}

export default InviteePointsBadge
