import React from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Icons/Icon'

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

/** every status that the icon badge can draw — `custom` has no glyph. */
export type IconStatusType = Exclude<StatusType, 'custom'>

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

interface BadgeProps {
    status: StatusType
    /** `text` (default) is the labelled pill. `icon` is the icon-only chip. */
    type?: 'text' | 'icon'
    className?: string
    size?: 'small' | 'medium'
    customText?: string
}

// board 17802:61533 colors: pending=attention, processing=info, fail=error,
// success=success, accent=soon/custom. borderless, dark text.
const STATUS_STYLES: Record<StatusType, string> = {
    completed: 'bg-background-badge-success',
    closed: 'bg-background-badge-success',
    refunded: 'bg-background-badge-success',
    pending: 'bg-background-badge-attention',
    processing: 'bg-background-badge-info',
    failed: 'bg-background-badge-error',
    cancelled: 'bg-background-badge-error',
    soon: 'bg-background-badge-accent',
    custom: 'bg-background-badge-accent',
}

// badge board type=icon glyphs (17312:137472-480, 18072:25494/25504/25520):
// processing = refresh arrow, soon = triangle, cancelled = ban — distinct
// from failed's x (the old map rendered cancelled and failed identically)
const STATUS_ICONS: Record<IconStatusType, IconName> = {
    completed: 'success',
    failed: 'cancel',
    processing: 'retry',
    soon: 'alert',
    pending: 'pending',
    cancelled: 'ban',
    refunded: 'undo',
    closed: 'success',
}

// board 17802:61533: small = px S/8 + py XXS/2 + Label/M, medium = px M/12
// + py XS/4 + Label/L. The paddings were already right; the type was raw
// stock tailwind (a 10px arbitrary and two stock steps), none of which is
// on the DS type scale.
const SIZE_CLASSES = {
    small: 'px-2 py-0.5 text-label-m',
    medium: 'px-3 py-1 text-label-l',
} as const

/**
 * Status badge from the badge board. `type="text"` is the labelled pill;
 * `type="icon"` is the icon-only chip (states board 17966:12128): 3px padding,
 * 14px icon, round, on the same status → colour map.
 *
 * `custom` has no glyph, so it renders as text whatever the type asks for.
 */
const Badge: React.FC<BadgeProps> = ({ status, type = 'text', className, size = 'small', customText }) => {
    const t = useTranslations('common')

    if (type === 'icon' && status !== 'custom') {
        return (
            <div
                className={twMerge(
                    // badge board 17479:137743: icon renders in foreground/over-color-secondary
                    'flex items-center justify-center rounded-round p-[3px] text-foreground-over-color-secondary',
                    STATUS_STYLES[status] ?? 'bg-background-badge-helper',
                    className
                )}
            >
                <Icon name={STATUS_ICONS[status]} size={14} />
            </div>
        )
    }

    // customText overrides the default label for any status type, allowing
    // callers to use a specific status style with custom text. The unknown
    // guard covers values that reach here through a cast — never render a raw
    // backend string.
    // Truthiness on purpose: callers pass customText='' to mean "no override"
    // (see SendLinkActionList's soon badge).
    const label = customText || t(STATUS_LABEL_KEYS[status] ?? 'status.unknown')

    return (
        <span
            className={twMerge(
                // no font-weight class here: the label tokens carry the board
                // weights (Label/M is 800, Label/L is 700) and a `font-semibold`
                // alongside them silently overrode both with 600.
                'inline-block rounded-full whitespace-nowrap text-foreground-over-color-secondary',
                SIZE_CLASSES[size],
                STATUS_STYLES[status] ?? 'bg-background-badge-helper',
                className
            )}
        >
            {label}
        </span>
    )
}

export default Badge
