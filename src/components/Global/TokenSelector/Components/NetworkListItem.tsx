/**
 * network row for the "More networks" list.
 *
 * Same anatomy as the token row: a real `0_Bruddle/ListItem` with the chain
 * logo as its single leading element, the fill + check selected skin, and the
 * option semantics on a wrapper (see the TokenListItem docblock for why).
 *
 * The old row wrapped a `Card` inside a `Button`, which put ~64px of content
 * inside `.btn`'s fixed 44px box — the content overflowed the button by ~10px.
 * `ListItem` owns its own height, so the bug goes with the wrapper.
 */

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import DisplayIcon from '@/components/Global/DisplayIcon'
import React from 'react'
import { twMerge } from '@/utils/tw'
import { Icon } from '../../Icons/Icon'
import Badge from '../../Badges/Badge'

interface NetworkListItemProps {
    name: string
    iconUrl?: string
    isSelected?: boolean
    isComingSoon?: boolean
    position?: CardPosition
    onClick?: () => void
}

const NetworkListItem: React.FC<NetworkListItemProps> = ({
    name,
    iconUrl,
    isSelected = false,
    isComingSoon = false,
    position = 'solo',
    onClick,
}) => {
    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined
    // ListItem only truncates a STRING title, and a filled row needs a node to
    // carry the colour — so the node re-states the board's one-line rule
    const line = twMerge('block truncate', paint)

    return (
        <div
            role="option"
            aria-selected={isSelected}
            aria-disabled={isComingSoon || undefined}
            tabIndex={isComingSoon ? undefined : 0}
            onClick={isComingSoon ? undefined : onClick}
            onKeyDown={(event) => {
                if (isComingSoon) return
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                onClick?.()
            }}
            className={twMerge(
                'focus-visible:outline-[3px] focus-visible:outline-action-focus',
                isComingSoon ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
        >
            <ListItem
                position={position}
                disabled={isComingSoon}
                className={twMerge(
                    'transition-colors duration-instant',
                    !isComingSoon && 'active:bg-background-disabled',
                    isSelected && !isComingSoon && 'bg-action-primary'
                )}
                leading={
                    <DisplayIcon iconUrl={iconUrl} altText={`${name} logo`} fallbackName={name} sizeClass="size-6" />
                }
                title={<span className={twMerge('capitalize', line)}>{name}</span>}
                trailing={
                    isComingSoon ? (
                        <Badge status="soon" />
                    ) : (
                        isSelected && <Icon name="check" size={20} className={paint} />
                    )
                }
            />
        </div>
    )
}

export default NetworkListItem
