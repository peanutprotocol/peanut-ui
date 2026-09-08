'use client'

import { twMerge } from '@/utils/tw'
import Card from '../Global/Card'
import { type CardPosition } from '../Global/Card/card.utils'
import { Icon } from '../Global/Icons/Icon'
import { useAppHaptic } from '@/hooks/useAppHaptic'

interface ListItemProps {
    title: React.ReactNode
    body?: React.ReactNode
    /** allow a string body to wrap instead of using the default one-line ellipsis */
    bodyWrap?: boolean
    /** leading slot: IconBubble, Icon, avatar, flag… (board leading content) */
    leading?: React.ReactNode
    /** trailing slot: value, toggle, badge… renders before the chevron */
    trailing?: React.ReactNode
    /** trailing chevron for rows that navigate */
    chevron?: boolean
    position?: CardPosition
    disabled?: boolean
    onClick?: () => void
    className?: string
    'data-testid'?: string
    'aria-label'?: string
}

/**
 * Row component from the figma list-item board (17802:61530).
 * Anatomy: leading slot + title (16/20 semibold) + body (14/20 secondary),
 * trailing slot / chevron. Grouping via position (top/middle/bottom/solo),
 * pressed = disabled-background fill, disabled (board 17785:14606) =
 * background/disabled fill + border/subtle + secondary title, content at full
 * opacity so badges and checkmarks keep their contrast. Rows compute to
 * >=48px (32px leading slot + p-4) — over the 44px touch-target floor.
 */
export const ListItem = ({
    title,
    body,
    bodyWrap = false,
    leading,
    trailing,
    chevron,
    position = 'single',
    disabled,
    onClick,
    className,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
}: ListItemProps) => {
    const { triggerHaptic } = useAppHaptic()
    const titleColor = disabled ? 'text-foreground-secondary' : 'text-foreground-primary'
    // every row click gets haptic feedback (both pointer and keyboard paths)
    const handleClick = onClick
        ? () => {
              triggerHaptic()
              onClick()
          }
        : undefined
    return (
        <Card
            position={position}
            onClick={disabled ? undefined : handleClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick && !disabled ? 0 : undefined}
            onKeyDown={
                handleClick && !disabled
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleClick()
                          }
                      }
                    : undefined
            }
            aria-disabled={disabled || undefined}
            aria-label={ariaLabel}
            data-testid={dataTestId}
            className={twMerge(
                'flex items-center justify-between gap-3 p-4',
                onClick &&
                    !disabled &&
                    'duration-instant focus-visible:outline-action-focus active:bg-background-disabled cursor-pointer transition-colors focus-visible:outline-[3px]',
                disabled && 'border-border-subtle bg-background-disabled',
                className
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                {leading}
                {/* plain strings get the board one-line truncation; custom nodes render
                    in a block wrapper untruncated (a div inside a span is invalid html
                    and truncate only ellipsizes text anyway) */}
                <div className="flex min-w-0 flex-col gap-0.5">
                    {typeof title === 'string' ? (
                        <span className={twMerge('text-body-m-semibold truncate', titleColor)}>{title}</span>
                    ) : (
                        <div className={twMerge('text-body-m-semibold min-w-0', titleColor)}>{title}</div>
                    )}
                    {body &&
                        (typeof body === 'string' ? (
                            <span
                                className={twMerge(
                                    'text-body-s text-foreground-secondary',
                                    bodyWrap ? 'whitespace-normal break-words' : 'truncate'
                                )}
                            >
                                {body}
                            </span>
                        ) : (
                            <div className="text-body-s text-foreground-secondary min-w-0">{body}</div>
                        ))}
                </div>
            </div>
            {(trailing || chevron) && (
                <div className="flex shrink-0 items-center gap-2">
                    {trailing}
                    {chevron && <Icon name="chevron-right" size={20} className={titleColor} />}
                </div>
            )}
        </Card>
    )
}
