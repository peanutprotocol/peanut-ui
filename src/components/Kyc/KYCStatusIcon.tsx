import { IconBubble } from '../0_Bruddle/IconBubble'
import { conceptBubbleFor } from '../0_Bruddle/conceptIcons'
import { type StatusType } from '../Global/Badges/Badge'

/**
 * The verification concept, colored by state: blue once verified, yellow while
 * processing or waiting on the user, red when failed, gray when the region is
 * restricted (TASK-22761).
 */
export const KYCStatusIcon = ({ status, regionRestricted }: { status?: StatusType; regionRestricted?: boolean }) => (
    <IconBubble {...conceptBubbleFor('verification', regionRestricted ? 'cancelled' : status)} size="s" />
)
