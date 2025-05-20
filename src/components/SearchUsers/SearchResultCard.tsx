import Card, { CardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import React from 'react'

interface SearchResultCardProps {
    title: string
    description?: string
    leftIcon?: React.ReactNode
    onClick: () => void
    position?: CardPosition
    className?: string
}

export const SearchResultCard = ({
    title,
    description,
    leftIcon,
    onClick,
    position = 'middle',
    className,
}: SearchResultCardProps) => {
    const handleCardClick = () => {
        onClick()
    }

    return (
        <Card
            onClick={handleCardClick}
            position={position}
            className={`cursor-pointer hover:bg-gray-50 ${className || ''}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {leftIcon}
                    <div className="flex flex-col">
                        <div className="font-medium">{title}</div>
                        {description && <div className="text-sm text-grey-1">{description}</div>}
                    </div>
                </div>
                <div className="flex size-6 items-center justify-center rounded-full border border-black bg-primary-1 p-0 shadow-[0.12rem_0.12rem_0_#000000]">
                    <Icon name="chevron-up" size={20} className="rotate-90" />
                </div>
            </div>
        </Card>
    )
}
