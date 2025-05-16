import Image from 'next/image'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
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
}) => {
    const [iconError, setIconError] = useState(false)

    return (
        <Button
            key={chainId}
            type="button"
            variant="transparent"
            className={twMerge(
                'w-full transform-none rounded-sm p-0 text-left shadow-sm hover:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-1'
            )}
            onClick={isComingSoon ? undefined : onClick}
            disabled={isComingSoon}
            aria-pressed={isSelected}
        >
            <Card
                position="single"
                className={twMerge(
                    'w-full !overflow-visible border-black p-4',
                    isSelected && !isComingSoon ? 'bg-primary-3' : 'bg-white',
                    isComingSoon && 'bg-grey-4'
                )}
                border={true}
            >
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="relative h-8 w-8">
                            {iconUrl && !iconError ? (
                                <Image
                                    src={iconUrl}
                                    alt={`${name} logo`}
                                    width={32}
                                    height={32}
                                    className={twMerge(!isComingSoon && 'rounded-full')}
                                    onError={() => setIconError(true)}
                                />
                            ) : (
                                <AvatarWithBadge size="extra-small" name={name} />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-semibold capitalize text-black">{name}</span>
                        </div>
                    </div>
                    {isComingSoon ? (
                        <StatusBadge status="soon" />
                    ) : (
                        <Icon name="chevron-up" className="size-6 rotate-90 text-black" />
                    )}
                </div>
            </Card>
        </Button>
    )
}

export default NetworkListItem
