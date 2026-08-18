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
            title={titleClassName ? <span className={twMerge(titleClassName)}>{title}</span> : title}
            body={
                description &&
                (descriptionClassName ? (
                    <span className={twMerge(descriptionClassName)}>{description}</span>
                ) : (
                    description
                ))
            }
            leading={leftIcon}
            trailing={rightContent}
            chevron={!rightContent}
            position={position}
            disabled={isDisabled}
            onClick={handleClick}
            className={className}
        />
    )
}
