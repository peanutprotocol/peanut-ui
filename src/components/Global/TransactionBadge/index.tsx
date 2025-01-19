'use client'
import { twMerge } from 'tailwind-merge'

interface BadgeProps {
    status: string
    className?: string
}

const getStatusStyles = (status: string): string => {
    switch (status.toLowerCase()) {
        case 'claimed':
            return 'border-pink-1 text-pink-1'
        case 'pending':
        case 'unclaimed':
            return 'border-n-3 text-n-3'
        case 'paid':
        case 'successful':
            return 'border-success-1 text-success-1'
        case 'canceled':
        case 'error':
            return 'border-error text-error'
        default:
            return 'border-n-3 text-n-3'
    }
}

export const TransactionBadge = ({ status, className }: BadgeProps) => {
    const statusStyles = getStatusStyles(status)

    return (
        <div className={twMerge('border p-0.5 text-center text-xs font-semibold capitalize', statusStyles, className)}>
            {status.toLowerCase()}
        </div>
    )
}
