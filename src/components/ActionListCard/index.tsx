'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { useHaptic } from 'use-haptic'

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
}: ActionListCardProps) => {
    const { triggerHaptic } = useHaptic()

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
            chevron={!rightContent}
            position={position}
            onClick={isDisabled ? undefined : handleClick}
            // legacy disabled look: grey fill (rows disabled-because-completed
            // must not fade like unavailable ones), not ListItem's opacity-40
            className={twMerge(isDisabled && 'bg-grey-4', className)}
        />
    )
}
