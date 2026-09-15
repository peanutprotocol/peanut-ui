/**
 * button component for selecting a network in the token selector
 *
 * displays chain icon and name, or a search icon for the "more" button
 */

import { Button } from '@/components/0_Bruddle/Button'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { twMerge } from '@/utils/tw'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

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
    const t = useTranslations('global')
    const [chainImageError, setChainImageError] = useState(false)

    return (
        <Button
            variant="stroke"
            className={twMerge(
                'shadow-2 flex h-fit min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-sm p-3 text-center text-foreground-primary hover:text-foreground-primary',
                isSelected
                    ? 'bg-action-primary/10 hover:bg-action-primary/10'
                    : 'bg-background-default hover:bg-background-default'
            )}
            onClick={onClick}
        >
            {isSearch ? (
                <IconBubble
                    icon="plus"
                    size="xs"
                    className="bg-foreground-primary"
                    iconClassName="text-foreground-inverse"
                />
            ) : (
                <div className="flex h-6 min-h-6 w-6 items-center justify-center rounded-full">
                    {chainIconURI && !chainImageError ? (
                        <Image
                            src={chainIconURI}
                            alt={chainName}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full"
                            onError={() => setChainImageError(true)}
                        />
                    ) : (
                        <AvatarWithBadge size="extra-small" name={chainName} />
                    )}
                </div>
            )}
            <span className="text-body-s">{isSearch ? t('tokenSelector.moreNetworksButton') : chainName}</span>
        </Button>
    )
}

export default NetworkButton
