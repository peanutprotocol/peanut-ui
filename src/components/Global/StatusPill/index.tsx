import { Icon, type IconName } from '../Icons/Icon'
import { twMerge } from '@/utils/tw'
import { type StatusType } from '../Badges/StatusBadge'

export type StatusPillType = Exclude<StatusType, 'custom'>

interface StatusPillProps {
    status: StatusPillType
}

/**
 * icon-only status chip per the states board (17966:12128): 3px padding,
 * 14px icon, round, on the badge background tokens — same status → color
 * mapping as StatusBadge.
 */
const StatusPill = ({ status }: StatusPillProps) => {
    const bgClasses: Record<StatusPillType, string> = {
        completed: 'bg-background-badge-success',
        closed: 'bg-background-badge-success',
        refunded: 'bg-background-badge-success',
        pending: 'bg-background-badge-attention',
        processing: 'bg-background-badge-info',
        soon: 'bg-background-badge-accent',
        cancelled: 'bg-background-badge-error',
        failed: 'bg-background-badge-error',
    }

    // badge board type=icon glyphs (17312:137472-480, 18072:25494/25504/25520):
    // processing = refresh arrow, soon = triangle, cancelled = ban — distinct
    // from failed's x (the old map rendered cancelled and failed identically)
    const iconClasses: Record<StatusPillType, IconName> = {
        completed: 'success',
        failed: 'cancel',
        processing: 'retry',
        soon: 'alert',
        pending: 'pending',
        cancelled: 'ban',
        refunded: 'undo',
        closed: 'success',
    }

    return (
        <div
            className={twMerge(
                // badge board 17479:137743: icon renders in foreground/over-color-secondary
                'flex items-center justify-center rounded-round p-[3px] text-foreground-over-color-secondary',
                bgClasses[status]
            )}
        >
            <Icon name={iconClasses[status]} size={14} />
        </div>
    )
}

export default StatusPill
