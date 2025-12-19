import { Icon, type IconName } from '../Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { type StatusType } from '../Badges/StatusBadge'

export type StatusPillType = Exclude<StatusType, 'custom'>

interface StatusPillProps {
    status: StatusPillType
}

const StatusPill = ({ status }: StatusPillProps) => {
    const colorClasses: Record<StatusPillType, string> = {
        completed: 'border-success-5 bg-success-2 text-success-4',
        pending: 'border-yellow-8 bg-secondary-4 text-yellow-6',
        cancelled: 'border-error-2 bg-error-1 text-error',
        refunded: 'border-error-2 bg-error-1 text-error',
        failed: 'border-error-2 bg-error-1 text-error',
        processing: 'border-yellow-8 bg-secondary-4 text-yellow-6',
        soon: 'border-yellow-8 bg-secondary-4 text-yellow-6',
        closed: 'border-success-5 bg-success-2 text-success-4',
    }

    const iconClasses: Record<StatusPillType, IconName> = {
        completed: 'success',
        failed: 'cancel',
        processing: 'pending',
        soon: 'pending',
        pending: 'pending',
        cancelled: 'cancel',
        refunded: 'cancel',
        closed: 'success',
    }

    const iconSize: Record<StatusPillType, number> = {
        completed: 7,
        failed: 6,
        processing: 10,
        soon: 7,
        pending: 8,
        cancelled: 6,
        refunded: 6,
        closed: 7,
    }

    return (
        <div
            className={twMerge(
                'flex size-[14px] items-center justify-center rounded-full border',
                colorClasses[status]
            )}
        >
            <Icon name={iconClasses[status]} size={iconSize[status]} />
        </div>
    )
}

export default StatusPill
