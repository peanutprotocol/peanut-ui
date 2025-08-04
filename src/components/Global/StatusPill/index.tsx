import React from 'react'
import { Icon, IconName } from '../Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { StatusType } from '../Badges/StatusBadge'

interface StatusPillProps {
    status: StatusType
}

const StatusPill = ({ status }: StatusPillProps) => {
    const colorClasses: Record<StatusType, string> = {
        completed: 'border-success-5 bg-success-2',
        pending: 'border-[#FAE184] bg-secondary-4',
        cancelled: 'border-error-2 bg-error-1 text-error',
        failed: 'border-error-2 bg-error-1 text-error',
        processing: 'border-[#FAE184] bg-secondary-4',
        soon: 'border-[#FAE184] bg-secondary-4',
    }

    const iconClasses: Record<StatusType, IconName> = {
        completed: 'success',
        failed: 'cancel',
        processing: 'pending',
        soon: 'pending',
        pending: 'pending',
        cancelled: 'cancel',
    }

    const iconSize: Record<StatusType, number> = {
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
