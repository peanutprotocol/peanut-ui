import Image from 'next/image'
import React, { useState } from 'react'
import { twMerge } from '@/utils/tw'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import NavigationArrow from '@/components/Global/NavigationArrow'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Badge from '../../Badges/Badge'

interface NetworkListItemProps {
    chainId: string
    name: string
    iconUrl?: string
    isSelected?: boolean
    isComingSoon?: boolean
    onClick?: () => void
    rightContent?: React.ReactNode
    titleClassName?: HTMLSpanElement['className']
    iconClassName?: HTMLImageElement['className']
}

const NetworkListItem: React.FC<NetworkListItemProps> = ({
    chainId,
    name,
    iconUrl,
    isSelected = false,
    isComingSoon = false,
    onClick,
    rightContent,
    titleClassName,
    iconClassName,
}) => {
    const [iconError, setIconError] = useState(false)

    return (
        <Button
            key={chainId}
            type="button"
            variant="transparent"
            className={twMerge('w-full transform-none rounded-sm p-0 text-left shadow-sm hover:transform-none')}
            onClick={isComingSoon ? undefined : onClick}
            disabled={isComingSoon}
            aria-pressed={isSelected}
        >
            <Card
                position="solo"
                className={twMerge(
                    'w-full !overflow-visible border-border-default p-4',
                    isSelected && !isComingSoon ? 'bg-action-primary' : 'bg-background-default',
                    isComingSoon && 'bg-background-disabled'
                )}
                border={true}
            >
                <div className="relative flex items-center justify-between">
                    <div className="space-x-3 flex items-center">
                        <div className="relative h-8 w-8">
                            {iconUrl && !iconError ? (
                                <Image
                                    src={iconUrl}
                                    alt={`${name} logo`}
                                    width={32}
                                    height={32}
                                    className={twMerge('rounded-full', iconClassName)}
                                    onError={() => setIconError(true)}
                                />
                            ) : (
                                <AvatarWithBadge size="extra-small" name={name} />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span
                                className={twMerge(
                                    'text-body-m-semibold text-foreground-primary capitalize',
                                    titleClassName
                                )}
                            >
                                {name}
                            </span>
                        </div>
                    </div>
                    {isComingSoon ? (
                        <Badge status="soon" />
                    ) : rightContent ? (
                        rightContent
                    ) : (
                        <NavigationArrow size={24} className="text-foreground-primary" />
                    )}
                </div>
            </Card>
        </Button>
    )
}

export default NetworkListItem
