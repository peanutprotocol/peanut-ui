import React from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'

export type StatusType =
    | 'completed'
    | 'pending'
    | 'failed'
    | 'cancelled'
    | 'soon'
    | 'processing'
    | 'custom'
    | 'closed'
    | 'refunded'

/**
 * Status → `common.status.*` catalog key. Exhaustive over StatusType, so a new
 * status can't compile without a label key — same pattern as TYPE_LABEL_KEYS.
 */
export const STATUS_LABEL_KEYS = {
    completed: 'status.completed',
    pending: 'status.pending',
    processing: 'status.processing',
    failed: 'status.failed',
    cancelled: 'status.cancelled',
    refunded: 'status.refunded',
    soon: 'status.soon',
    closed: 'status.closed',
    custom: 'status.custom',
} as const satisfies Record<StatusType, string>

interface StatusBadgeProps {
    status: StatusType
    className?: string
    size?: 'small' | 'medium' | 'large'
    customText?: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, size = 'small', customText }) => {
    const t = useTranslations('common')

    // board 17802:61533 colors: pending=attention, processing=info, fail=error,
    // success=success, accent=soon/custom. borderless, dark text.
    const getStatusStyles = () => {
        switch (status) {
            case 'completed':
            case 'closed':
            case 'refunded':
                return 'bg-background-badge-success text-foreground-over-color-secondary'
            case 'pending':
                return 'bg-background-badge-attention text-foreground-over-color-secondary'
            case 'processing':
                return 'bg-background-badge-info text-foreground-over-color-secondary'
            case 'failed':
            case 'cancelled':
                return 'bg-background-badge-error text-foreground-over-color-secondary'
            case 'soon':
            case 'custom':
                return 'bg-background-badge-accent text-foreground-over-color-secondary'
            default:
                return 'bg-background-badge-helper text-foreground-over-color-secondary'
        }
    }

    // customText overrides the default label for any status type, allowing
    // callers to use a specific status style with custom text. The unknown
    // guard covers values that reach here through a cast — never render a raw
    // backend string.
    // Truthiness on purpose: callers pass customText='' to mean "no override"
    // (see SendLinkActionList's soon badge).
    const label = customText || t(STATUS_LABEL_KEYS[status] ?? 'status.unknown')

    // board 17802:61533: small = px S/8 + py XXS/2 + Label/M, medium = px M/12
    // + py XS/4 + Label/L. The paddings were already right; the type was raw
    // stock tailwind (a 10px arbitrary and two stock steps), none of which is
    // on the DS type scale. `large` has no board row, so it keeps its padding
    // and takes the nearest label step.
    const getSizeClasses = () => {
        switch (size) {
            case 'medium':
                return 'px-3 py-1 text-label-l'
            case 'large':
                return 'px-4 py-1.5 text-label-l'
            case 'small':
            default:
                return 'px-2 py-0.5 text-label-m'
        }
    }

    return (
        <span
            className={twMerge(
                // no font-weight class here: the label tokens carry the board
                // weights (Label/M is 800, Label/L is 700) and a `font-semibold`
                // alongside them silently overrode both with 600.
                'inline-block rounded-full whitespace-nowrap',
                getSizeClasses(),
                getStatusStyles(),
                className
            )}
        >
            {label}
        </span>
    )
}

export default StatusBadge
