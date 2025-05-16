import { Button } from '@/components/0_Bruddle'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Image from 'next/image'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../../Icons/Icon'

interface NetworkButtonProps {
    chainName: string
    chainIconURI?: string
    onClick: () => void
    isSearch?: boolean
    isSelected?: boolean
}

const NetworkButton: React.FC<NetworkButtonProps> = ({
    chainName,
    chainIconURI,
    onClick,
    isSearch = false,
    isSelected = false,
}) => {
    const [chainImageError, setChainImageError] = useState(false)

    return (
        <Button
            variant="stroke"
            className={twMerge(
                'shadow-2 flex h-fit min-w-14 flex-1 flex-col items-center justify-center gap-1 p-3 text-center text-black hover:text-black',
                isSelected ? 'bg-primary-3 hover:bg-primary-3' : 'bg-white hover:bg-white'
            )}
            onClick={onClick}
        >
            <div
                className={twMerge(
                    'flex h-6 min-h-6 w-6 items-center justify-center rounded-full',
                    isSearch ? 'bg-black p-0.5 text-white' : 'bg-transparent'
                )}
            >
                {isSearch ? (
                    <Icon name="cancel" size={12} className="size-4 rotate-45" />
                ) : chainIconURI && !chainImageError ? (
                    <Image
                        src={chainIconURI}
                        alt={chainName}
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full"
                        onError={() => setChainImageError(true)}
                    />
                ) : (
                    <AvatarWithBadge size="extra-small" name={chainName} achievementsBadgeSize="extra-small" />
                )}
            </div>
            <span className="text-sm font-medium">{isSearch ? 'more' : chainName}</span>
        </Button>
    )
}

export default NetworkButton
