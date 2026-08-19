'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { useAppHaptic } from '@/hooks/useAppHaptic'

interface ActionListCardProps {
    title: string | React.ReactNode
    description?: string
    leftIcon?: React.ReactNode
    onClick: () => void
    position?: CardPosition
    className?: string
    rightContent?: React.ReactNode
    isDisabled?: boolean
    descriptionClassName?: string
    titleClassName?: string
    /** default: chevron shows when no rightContent. pass false to suppress it
     *  (replaces the rightContent={<div className="hidden" />} hack) */
    chevron?: boolean
}

// ds-06: thin haptic wrapper over the ListItem primitive (board 17802:61530) —
// same API as before, rendering delegated to the one row component.
export const ActionListCard = ({
    title,
    description,
    leftIcon,
    onClick,
    position = 'middle',
    className,
    rightContent,
    isDisabled = false,
    descriptionClassName,
    titleClassName,
    chevron,
}: ActionListCardProps) => {
    const { triggerHaptic } = useAppHaptic()

    const handleClick = () => {
        triggerHaptic()
        onClick()
    }

    return (
        <ListItem
            // always node-wrapped: legacy call sites pass sentence-length
            // descriptions and block nodes that must wrap, not truncate
            title={<div className={twMerge(titleClassName)}>{title}</div>}
            body={description && <div className={twMerge(descriptionClassName)}>{description}</div>}
            leading={leftIcon}
            trailing={rightContent}
            chevron={chevron ?? !rightContent}
            position={position}
            disabled={isDisabled}
            onClick={handleClick}
            // legacy disabled look: grey fill (rows disabled-because-completed
            // must not fade like unavailable ones) — opacity-100 overrides
            // ListItem's opacity-40 while keeping its aria-disabled
            className={twMerge(isDisabled && 'bg-grey-4 opacity-100', className)}
        />
    )
}
