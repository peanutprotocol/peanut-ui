import { Icon, IconName } from '../Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { StatusType } from '../Badges/StatusBadge'

export type TStatusPillType = Exclude<StatusType, 'custom'>

interface StatusPillProps {
    status: TStatusPillType
}

const StatusPill = ({ status }: StatusPillProps) => {
    const colorClasses: Record<TStatusPillType, string> = {
        completed: 'border-success-5 bg-success-2 text-success-4',
        pending: 'border-yellow-8 bg-secondary-4 text-yellow-6',
        cancelled: 'border-error-2 bg-error-1 text-error',
        failed: 'border-error-2 bg-error-1 text-error',
        processing: 'border-yellow-8 bg-secondary-4 text-yellow-6',
        soon: 'border-yellow-8 bg-secondary-4 text-yellow-6',
    }

    const iconClasses: Record<TStatusPillType, IconName> = {
        completed: 'success',
        failed: 'cancel',
        processing: 'pending',
        soon: 'pending',
        pending: 'pending',
        cancelled: 'cancel',
    }

    const iconSize: Record<TStatusPillType, number> = {
        completed: 10,
        failed: 7,
        processing: 10,
        soon: 10,
        pending: 10,
        cancelled: 7,
    }

    return (
        <div
            className={twMerge(
                'absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-full border',
                colorClasses[status]
            )}
        >
            <Icon name={iconClasses[status]} size={iconSize[status]} />
        </div>
    )
}

export default StatusPill
