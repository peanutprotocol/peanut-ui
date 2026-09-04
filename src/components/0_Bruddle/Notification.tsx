'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'
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
    /** suppress the leading priority icon (self-designed content, e.g. badge toasts) */
    hideIcon?: boolean
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
    error: { icon: 'ban', bg: 'bg-background-badge-error' }, // board error glyph is the ban circle, not alert-circle,
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
 *
 * A checklist has no leading priority icon. All four InfoCard call-sites that
 * passed `items` also passed no `icon` — the check marks already carry the
 * tone, and a second (i) in front of the block reads as a stray glyph. The
 * rule lives here rather than as an opt-out prop at each call site.
 *
 * SPACING, 2026-09-04 — partial reversal of the TASK-22121 compact-inline
 * ruling (kush, 2026-09-03, `9515dcf7a`). Variant A changed four things at
 * once: no border, one type step down, a 16px icon, AND halved padding and
 * gaps (p-3 → p-2, gap-2 → gap-1.5 in three places). On device the first
 * three read well and the fourth did not — the tint block sat too close to
 * its own text, which is what the border used to keep it off. Padding and
 * gaps are back at 12px/8px; the border, type step and icon size stay at
 * variant A. `indent` is recomputed from the 16px icon rather than restored,
 * so it clears the icon that actually renders. Vertical rhythm INSIDE the
 * content group (the 2px title→body pair from board 17872:89021) is a
 * separate, earlier ruling and is untouched.
 */
export const Notification = ({
    priority = 'info',
    hideIcon = false,
    title,
    children,
    items,
    onDismiss,
    ctas,
    className,
    ...props
}: NotificationProps) => {
    const t = useTranslations('common')
    const { icon, bg } = PRIORITY_STYLES[priority]
    // `items` wins whenever it is passed at all — an explicit [] means "no rows",
    // not "fall back to children"
    const body = items
        ? items.length > 0 && (
              // rows read at the same Body/S step as every other body — the
              // old text-body-xs (12px) checklist step is gone (TASK-22121:
              // one body size everywhere). The 16px check sits in the 20px
              // Body/S line box with a 2px nudge, pinned to the first line.
              <div className="flex flex-col gap-1">
                  {items.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">{item}</div>
                      </div>
                  ))}
              </div>
          )
        : children
    // a checklist carries its own check marks — no leading priority icon
    const showIcon = !items && !hideIcon
    // the title body and the ctas line up under the title, which the leading
    // icon pushes in by 24px (16px icon + the restored 8px gap). Recomputed,
    // not reverted to the old pl-7: that cleared a 20px icon, and variant A's
    // 16px icon stands.
    const indent = showIcon ? 'pl-6' : ''
    // an empty `items` array used to fall through to `children` (undefined at
    // every migrated call site) and paint a bare icon-only box — WelcomeUnlockModal
    // hits that when the user unlocked no channel at all
    if (!body && !title && !ctas?.length) return null
    return (
        <div
            role={priority === 'error' || priority === 'attention' ? 'alert' : 'status'}
            className={twMerge(
                // text-start is load-bearing: ActionModal centres its content
                // container, and a notification inside a modal must still read
                // left-aligned. The deleted InfoCard carried the same guard.
                // compact-inline (TASK-22121 variant A): tint only, no border,
                // one type step down — but at the ORIGINAL 12px padding and 8px
                // gaps. Variant A also halved both, and on a device the tint
                // block read as cramped against its own text; reverted
                // 2026-09-04 (see the block comment above).
                'flex items-start gap-2 rounded-sm p-3 text-start text-foreground-over-color-secondary',
                bg,
                className
            )}
            {...props}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                {/* board 17872:89021 nests a "Content" group (title + body, 2px
                    apart) inside the 8px stack, so the body hugs its title and
                    only the ctas sit a full step away. A flat gap-2 put 8px in
                    both places and the title read as a separate line. */}
                <div className="flex flex-col gap-0.5">
                    {/* items-start pins the icon to the first line. The 16px
                        icon sits in the 20px Body/S line box with a 2px nudge —
                        a list or a wrapping body never centres the icon against
                        the whole block. */}
                    <div className="flex items-start gap-2">
                        {showIcon && <Icon name={icon} size={16} className="mt-0.5 shrink-0" />}
                        {title ? (
                            <span className="text-body-s font-semibold">{title}</span>
                        ) : (
                            <div className="min-w-0 flex-1 text-body-s break-words">{body}</div>
                        )}
                    </div>
                    {title && <div className={twMerge('text-body-s break-words', indent)}>{body}</div>}
                </div>
                {!!ctas?.length && (
                    <div className={twMerge('flex flex-wrap gap-2', indent)}>
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
                    aria-label={t('close')}
                    onClick={onDismiss}
                    className="relative -m-1 flex size-6 shrink-0 items-center justify-center rounded-round text-foreground-over-color-secondary transition-opacity duration-instant after:absolute after:-inset-2.5 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                >
                    <Icon name="cancel" size={12} />
                </button>
            )}
        </div>
    )
}
