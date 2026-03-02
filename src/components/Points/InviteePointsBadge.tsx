'use client'

import { useCountUp } from '@/hooks/useCountUp'
import { formatPoints } from '@/utils/format.utils'

interface InviteePointsBadgeProps {
    points: number
    inView: boolean
}

/** animated points badge for invitee rows — triggers when scrolled into view */
const InviteePointsBadge = ({ points, inView }: InviteePointsBadgeProps) => {
    const animated = useCountUp(points, { duration: 1.2, enabled: inView })
    return (
        <p className="text-grey-1">
            +{formatPoints(animated)} {points === 1 ? 'pt' : 'pts'}
        </p>
    )
}

export default InviteePointsBadge
