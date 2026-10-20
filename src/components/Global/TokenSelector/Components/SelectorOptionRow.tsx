/**
 * one row in the token or network drawer.
 *
 * A real `0_Bruddle/ListItem`: leading = the logo alone (no mini-badge over
 * it), title = symbol or network name, body = the badge line. Selected =
 * `bg-background-selection` + `text-foreground-over-color-primary` + a
 * trailing 20px check (design.md "selected list rows"). `ListItem` forwards
 * no `role`/`aria-selected`, so the option semantics ride a wrapper — same
 * pattern as `TokenListItem`.
 */

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import DisplayIcon from '@/components/Global/DisplayIcon'
import { twMerge } from '@/utils/tw'
import React from 'react'
import { Icon } from '../../Icons/Icon'

interface SelectorOptionRowProps {
    title: string
    iconUrl?: string
    body?: React.ReactNode
    isSelected: boolean
    /** not selectable: the row stays visible, greyed, and ignores taps */
    disabled?: boolean
    onClick: () => void
    position?: CardPosition
}

const SelectorOptionRow: React.FC<SelectorOptionRowProps> = ({
    title,
    iconUrl,
    body,
    isSelected,
    disabled = false,
    onClick,
    position = 'solo',
}) => {
    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined

    return (
        <div
            role="option"
            aria-selected={isSelected}
            aria-disabled={disabled || undefined}
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onClick}
            onKeyDown={(event) => {
                if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
                event.preventDefault()
                onClick()
            }}
            className={twMerge(
                'focus-visible:outline-[3px] focus-visible:outline-action-focus',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
        >
            <ListItem
                position={position}
                disabled={disabled}
                className={twMerge(
                    !disabled && 'transition-colors duration-instant active:bg-background-disabled',
                    isSelected && 'bg-background-selection'
                )}
                leading={<DisplayIcon iconUrl={iconUrl} altText="" fallbackName={title} sizeClass="size-6" />}
                title={<span className={twMerge('block truncate', paint)}>{title}</span>}
                body={body}
                trailing={isSelected && <Icon name="check" size={20} className={paint} />}
            />
        </div>
    )
}

export default SelectorOptionRow
