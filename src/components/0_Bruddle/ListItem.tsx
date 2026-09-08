'use client'

import { useId } from 'react'
import { twMerge } from '@/utils/tw'
import Card from '../Global/Card'
import { type CardPosition } from '../Global/Card/card.utils'
import { Icon } from '../Global/Icons/Icon'
import { useAppHaptic } from '@/hooks/useAppHaptic'

interface ListItemProps {
    /** Render the row action beside independently interactive slots. */
    interactiveContent?: boolean
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
    'aria-pressed'?: boolean
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
    interactiveContent = false,
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
    'aria-pressed': ariaPressed,
}: ListItemProps) => {
    const labelId = useId()
    const separateAction = interactiveContent && !!onClick
    const slotInteractions = separateAction
        ? 'pointer-events-none relative [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10 [&_a]:pointer-events-auto [&_a]:relative [&_a]:z-10 [&_[tabindex]]:pointer-events-auto [&_[tabindex]]:relative [&_[tabindex]]:z-10'
        : undefined
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
            asButton={!!onClick && !separateAction}
            position={position}
            onClick={disabled || separateAction ? undefined : handleClick}
            role={onClick && !separateAction ? 'button' : undefined}
            tabIndex={onClick && !disabled && !separateAction ? 0 : undefined}
            onKeyDown={
                handleClick && !disabled && !separateAction
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleClick()
                          }
                      }
                    : undefined
            }
            aria-disabled={disabled || undefined}
            aria-label={separateAction ? undefined : ariaLabel}
            aria-pressed={separateAction ? undefined : ariaPressed}
            data-testid={dataTestId}
            className={twMerge(
                'a11y-list-item relative flex items-center justify-between gap-3 p-4',
                onClick &&
                    !disabled &&
                    'cursor-pointer transition-colors duration-instant focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-disabled',
                disabled && 'border-border-subtle bg-background-disabled',
                className
            )}
        >
            {separateAction && (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={handleClick}
                    aria-label={ariaLabel}
                    aria-labelledby={
                        ariaLabel
                            ? undefined
                            : [
                                  `${labelId}-title`,
                                  body && `${labelId}-body`,
                                  (trailing || chevron) && `${labelId}-trailing`,
                              ]
                                  .filter(Boolean)
                                  .join(' ')
                    }
                    aria-pressed={ariaPressed}
                    className="a11y-row-action absolute inset-0 focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-background-disabled"
                />
            )}
            <div className={twMerge('a11y-list-content flex min-w-0 flex-1 items-center gap-3', slotInteractions)}>
                {leading}
                {/* plain strings get the board one-line truncation; custom nodes render
                    in a block wrapper untruncated (a div inside a span is invalid html
                    and truncate only ellipsizes text anyway) */}
                <div className="flex min-w-0 flex-col gap-0.5">
                    {typeof title === 'string' ? (
                        <span
                            id={`${labelId}-title`}
                            className={twMerge('a11y-wrap truncate text-body-m-semibold', titleColor)}
                        >
                            {title}
                        </span>
                    ) : (
                        <div id={`${labelId}-title`} className={twMerge('min-w-0 text-body-m-semibold', titleColor)}>
                            {title}
                        </div>
                    )}
                    {body &&
                        (typeof body === 'string' ? (
                            <span
                                id={`${labelId}-body`}
                                className="a11y-wrap truncate text-body-s text-foreground-secondary"
                            >
                                {body}
                            </span>
                        ) : (
                            <div id={`${labelId}-body`} className="min-w-0 text-body-s text-foreground-secondary">
                                {body}
                            </div>
                        ))}
                </div>
            </div>
            {(trailing || chevron) && (
                <div
                    id={`${labelId}-trailing`}
                    className={twMerge('flex shrink-0 items-center gap-2', slotInteractions)}
                >
                    {trailing}
                    {chevron && <Icon name="chevron-right" size={20} className={titleColor} />}
                </div>
            )}
        </Card>
    )
}
