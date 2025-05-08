import React from 'react'
import { twMerge } from 'tailwind-merge'

export type StatusType = 'completed' | 'pending' | 'failed' | 'cancelled' | 'soon' | 'processing'

interface StatusBadgeProps {
    status: StatusType
    className?: string
    size?: 'small' | 'medium' | 'large'
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, size = 'small' }) => {
    const getStatusStyles = () => {
        switch (status) {
            case 'completed':
                return 'bg-success-2 text-success-4 border border-success-5'
            case 'pending':
            case 'processing':
                return 'bg-secondary-4 text-yellow-6 border border-yellow-7'
            case 'failed':
            case 'cancelled':
                return 'bg-error-1 text-error border border-error-2'
            case 'soon':
                return 'bg-primary-3 text-primary-4'
            default:
                return 'bg-grey-2 text-grey-1'
        }
    }

    const getStatusText = () => {
        switch (status) {
            case 'completed':
                return 'Completed'
            case 'pending':
                return 'Pending'
            case 'processing':
                return 'Processing'
            case 'failed':
                return 'Failed'
            case 'cancelled':
                return 'Cancelled'
            case 'soon':
                return 'Soon!'
            default:
                return status
        }
    }

    const getSizeClasses = () => {
        switch (size) {
            case 'small':
                return 'px-2 py-0.5 text-[10px]'
            case 'medium':
                return 'px-3 py-1 text-xs'
            case 'large':
                return 'px-4 py-1.5 text-sm'
            default:
                return 'px-2 py-0.5 text-[10px]'
        }
    }

    return (
        <span
            className={twMerge(
                'inline-block whitespace-nowrap rounded-full',
                'font-roboto font-semibold',
                getSizeClasses(),
                getStatusStyles(),
                className
            )}
        >
            {getStatusText()}
        </span>
    )
}

export default StatusBadge
