'use client'

import { twMerge } from '@/utils/tw'
import Card from '../Global/Card'
import { type CardPosition } from '../Global/Card/card.utils'
import { Icon } from '../Global/Icons/Icon'
import { useAppHaptic } from '@/hooks/useAppHaptic'

interface ListItemProps {
    title: React.ReactNode
    body?: React.ReactNode
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
 * pressed = disabled-background fill, disabled = 40% opacity. 56px tall at
 * default padding — over the 44px touch-target floor.
 */
export const ListItem = ({
    title,
    body,
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
                    'cursor-pointer transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-disabled',
                disabled && 'opacity-40',
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
                        <span className="truncate text-body-m-semibold text-foreground-primary">{title}</span>
                    ) : (
                        <div className="min-w-0 text-body-m-semibold text-foreground-primary">{title}</div>
                    )}
                    {body &&
                        (typeof body === 'string' ? (
                            <span className="truncate text-body-s text-foreground-secondary">{body}</span>
                        ) : (
                            <div className="min-w-0 text-body-s text-foreground-secondary">{body}</div>
                        ))}
                </div>
            </div>
            {(trailing || chevron) && (
                <div className="flex shrink-0 items-center gap-2">
                    {trailing}
                    {chevron && <Icon name="chevron-right" size={20} className="text-foreground-primary" />}
                </div>
            )}
        </Card>
    )
}
