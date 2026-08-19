import { Icon, type IconName } from '../Icons/Icon'
import { twMerge } from 'tailwind-merge'
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

    const iconClasses: Record<StatusPillType, IconName> = {
        completed: 'success',
        failed: 'cancel',
        processing: 'pending',
        soon: 'pending',
        pending: 'pending',
        cancelled: 'cancel',
        refunded: 'undo',
        closed: 'success',
    }

    return (
        <div
            className={twMerge(
                'flex items-center justify-center rounded-round p-[3px] text-foreground-primary',
                bgClasses[status]
            )}
        >
            <Icon name={iconClasses[status]} size={14} />
        </div>
    )
}

export default StatusPill
