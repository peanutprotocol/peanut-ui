import Image from 'next/image'
import React from 'react'
import { twMerge } from 'tailwind-merge'

import Card from '@/components/Global/Card'
import StatusBadge from '../../Badges/StatusBadge'
import { Icon } from '../../Icons/Icon'

interface NetworkListItemProps {
    chainId: string
    name: string
    iconUrl?: string
    isSelected?: boolean
    isComingSoon?: boolean
    onClick?: () => void
}

const NetworkListItem: React.FC<NetworkListItemProps> = ({
    chainId,
    name,
    iconUrl,
    isSelected = false,
    isComingSoon = false,
    onClick,
}) => (
    <div
        key={chainId}
        className={twMerge('cursor-pointer rounded-sm shadow-sm', isSelected && !isComingSoon && 'bg-primary-3')}
        onClick={isComingSoon ? undefined : onClick}
    >
        <Card
            position="single"
            className={twMerge(
                '!overflow-visible border-black p-4',
                isSelected && !isComingSoon ? 'bg-primary-3' : 'bg-white',
                isComingSoon && 'bg-grey-4'
            )}
            border={true}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="relative h-8 w-8">
                        {iconUrl ? (
                            <Image
                                src={iconUrl}
                                alt={`${name} logo`}
                                width={32}
                                height={32}
                                className={twMerge(!isComingSoon && 'rounded-full')}
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-black">
                                {name?.substring(0, 2)?.toUpperCase() || 'CH'}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-semibold capitalize text-black">{name}</span>
                    </div>
                </div>
                {isComingSoon ? (
                    <StatusBadge status="soon" />
                ) : (
                    <Icon name="chevron-up" size={32} className="h-8 w-8 flex-shrink-0 rotate-90 text-black" />
                )}
            </div>
        </Card>
    </div>
)

export default NetworkListItem
