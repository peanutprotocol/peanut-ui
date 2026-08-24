'use client'

import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '../Global/Icons/Icon'
import { Button } from './Button'

type NotificationPriority = 'info' | 'success' | 'attention' | 'helper' | 'error'

interface NotificationCta {
    label: string
    onClick: () => void
}

interface NotificationProps {
    /** Sets the tone, background, and leading icon. */
    priority?: NotificationPriority
    /** Optional bold first line. Body renders indented under it. */
    title?: string
    /** Body text. Ignored when `items` is set. */
    children?: React.ReactNode
    /** Checklist body: one check-marked row per entry, instead of `children`. */
    items?: React.ReactNode[]
    /** When set, shows a close button (dismissible variant). */
    onDismiss?: () => void
    /** One or two actions: first renders purple (primary), second stroke (secondary). */
    ctas?: [NotificationCta] | [NotificationCta, NotificationCta]
    className?: string
    'data-testid'?: string
}

const PRIORITY_STYLES: Record<NotificationPriority, { icon: IconName; bg: string }> = {
    info: { icon: 'info', bg: 'bg-background-badge-info' },
    success: { icon: 'check', bg: 'bg-background-badge-success' },
    attention: { icon: 'alert', bg: 'bg-background-badge-attention' },
    helper: { icon: 'info', bg: 'bg-background-badge-helper' },
    error: { icon: 'error', bg: 'bg-background-badge-error' },
}

const CTA_VARIANTS = ['purple', 'stroke'] as const

/**
 * Inline notification banner from the figma notification board (17802:61535):
 * priority (info/success/attention/helper/error) sets the tone and icon;
 * supports body or title + body, optional dismiss, and up to two CTAs.
 *
 * `items` is the checklist body the deleted InfoCard used to own. Four modals
 * hand-rolled the same check-row markup on top of `children` and each got the
 * icon alignment wrong, so the rows live here now — one place to be right.
 */
export const Notification = ({
    priority = 'info',
    title,
    children,
    items,
    onDismiss,
    ctas,
    className,
    ...props
}: NotificationProps) => {
    const { icon, bg } = PRIORITY_STYLES[priority]
    const body = items?.length ? (
        <div className="flex flex-col gap-1">
            {items.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                    {/* mt-0.5 centres the 16px check on the 20px first line */}
                    <Icon name="check" size={16} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">{item}</div>
                </div>
            ))}
        </div>
    ) : (
        children
    )
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge(
                // text-start is load-bearing: ActionModal centres its content
                // container, and a notification inside a modal must still read
                // left-aligned. The deleted InfoCard carried the same guard.
                'flex items-start gap-2 rounded-sm border border-foreground-over-color-secondary p-3 text-start text-foreground-over-color-secondary',
                bg,
                className
            )}
            {...props}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/* items-start pins the icon to the first line. The icon is
                    20px and every first-line token is a 20px line box, so a
                    one-line banner is unchanged — but a list or a wrapping
                    body no longer centres the icon against the whole block. */}
                <div className="flex items-start gap-2">
                    <Icon name={icon} size={20} className="shrink-0" />
                    {title ? (
                        <span className="text-body-m-semibold">{title}</span>
                    ) : (
                        <div className="min-w-0 flex-1 text-body-m">{body}</div>
                    )}
                </div>
                {title && <div className="pl-7 text-body-m">{body}</div>}
                {!!ctas?.length && (
                    <div className="flex flex-wrap gap-2 pl-7">
                        {ctas.slice(0, 2).map((cta, i) => (
                            <Button
                                key={i}
                                size="small"
                                variant={CTA_VARIANTS[i]}
                                icon="chevron-right"
                                iconPosition="right"
                                onClick={cta.onClick}
                                className="w-auto min-w-28"
                            >
                                {cta.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={onDismiss}
                    className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-round text-foreground-over-color-secondary"
                >
                    <Icon name="cancel" size={16} />
                </button>
            )}
        </div>
    )
}
