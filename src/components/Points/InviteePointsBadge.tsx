'use client'

import { useCountUp } from '@/hooks/useCountUp'
import { formatPoints } from '@/utils/format.utils'

interface InviteePointsBadgeProps {
    points: number
    inView: boolean
    /** usd earned from this invitee (rewards v2) — shown instead of points when available */
    lifetimeEarnedUsd?: number
}

/** animated badge for invitee rows — shows $ when available, falls back to points */
const InviteePointsBadge = ({ points, inView, lifetimeEarnedUsd }: InviteePointsBadgeProps) => {
    const animated = useCountUp(points, { duration: 1.2, enabled: inView })

    // show USD rewards when available, points as fallback
    if (lifetimeEarnedUsd !== undefined && lifetimeEarnedUsd > 0) {
        return <p className="font-semibold text-green-1">${lifetimeEarnedUsd.toFixed(2)}</p>
    }

    return (
        <p className="text-grey-1">
            +{formatPoints(animated)} {points === 1 ? 'pt' : 'pts'}
        </p>
    )
}

export default InviteePointsBadge
