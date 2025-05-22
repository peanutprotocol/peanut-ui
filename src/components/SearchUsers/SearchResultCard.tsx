import Card, { CardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'

interface SearchResultCardProps {
    title: string
    description?: string
    leftIcon?: React.ReactNode
    onClick: () => void
    position?: CardPosition
    className?: string
    rightContent?: React.ReactNode
    isDisabled?: boolean
    descriptionClassName?: string
}

export const SearchResultCard = ({
    title,
    description,
    leftIcon,
    onClick,
    position = 'middle',
    className,
    rightContent,
    isDisabled = false,
    descriptionClassName,
}: SearchResultCardProps) => {
    const handleCardClick = () => {
        onClick()
    }

    return (
        <Card
            onClick={isDisabled ? undefined : handleCardClick}
            position={position}
            className={twMerge('cursor-pointer hover:bg-gray-50', isDisabled ? 'bg-grey-4' : '', className)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {leftIcon}
                    <div className="flex flex-col">
                        <div className="font-medium">{title}</div>
                        {description && (
                            <div className={twMerge('text-sm text-grey-1', descriptionClassName)}>{description}</div>
                        )}
                    </div>
                </div>
                {rightContent ? (
                    rightContent
                ) : (
                    <Button
                        shadowSize="4"
                        size="small"
                        className="h-6 w-6 rounded-full p-0 shadow-[0.12rem_0.12rem_0_#000000]"
                    >
                        <div className="flex size-7 items-center justify-center">
                            <Icon name="chevron-up" className="h-9 rotate-90" />
                        </div>
                    </Button>
                )}
            </div>
        </Card>
    )
}
