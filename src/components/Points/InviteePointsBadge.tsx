'use client'

import { useCountUp } from '@/hooks/useCountUp'
import { formatPoints } from '@/utils/format.utils'

interface InviteePointsBadgeProps {
    points: number
    inView: boolean
    /** usd earned from this invitee (rewards v2) — shown instead of points when available */
    lifetimeEarnedUsd?: number
}

/** Invitee badge — primary: $ earned, secondary: points. Same stacked pattern as TransactionCard. */
const InviteePointsBadge = ({ points, inView, lifetimeEarnedUsd }: InviteePointsBadgeProps) => {
    const animated = useCountUp(points, { duration: 1.2, enabled: inView })

    if (lifetimeEarnedUsd !== undefined && lifetimeEarnedUsd > 0) {
        return (
            <div className="flex flex-col items-end">
                <span className="font-semibold">${lifetimeEarnedUsd.toFixed(2)}</span>
                <span className="text-sm font-medium text-grey-1">
                    +{formatPoints(animated)} {points === 1 ? 'pt' : 'pts'}
                </span>
            </div>
        )
    }

    return (
        <p className="text-grey-1">
            +{formatPoints(animated)} {points === 1 ? 'pt' : 'pts'}
        </p>
    )
}

export default InviteePointsBadge
