import StatusBadge from '@/components/Global/Badges/StatusBadge'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import { Tooltip } from '@/components/Tooltip'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ProfileMenuItemProps {
    icon: IconName
    label: string
    href?: string
    onClick?: () => void
    position?: CardPosition
    comingSoon?: boolean
    isExternalLink?: boolean
    endIcon?: IconName
    endIconClassName?: string
    showTooltip?: boolean
    toolTipText?: string
}

const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({
    icon,
    label,
    href,
    onClick,
    position = 'middle',
    comingSoon = false,
    isExternalLink,
    endIcon,
    endIconClassName,
    showTooltip = false,
    toolTipText,
}) => {
    const content = (
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
                <Icon name={icon} size={20} fill="black" />
                <span className="text-base font-medium">{label}</span>
                {showTooltip && (
                    <Tooltip content={toolTipText}>
                        <Icon name="info" size={14} fill="black" />
                    </Tooltip>
                )}
            </div>

            <div className="flex items-center">
                {comingSoon ? (
                    <StatusBadge status="soon" size="medium" />
                ) : (
                    <Icon
                        name={endIcon ?? 'chevron-up'}
                        size={24}
                        fill="black"
                        className={twMerge(endIcon ? endIconClassName : 'rotate-90')}
                    />
                )}
            </div>
        </div>
    )

    if (comingSoon || !href) {
        return (
            <Card position={position} className="bg-grey-4 p-4">
                {content}
            </Card>
        )
    }

    if (onClick) {
        return (
            <Card position={position} onClick={onClick} className="cursor-pointer p-4 active:bg-grey-4">
                {content}
            </Card>
        )
    }

    return (
        <Link
            href={href}
            className="block"
            target={isExternalLink ? '_blank' : undefined}
            rel={isExternalLink ? 'noopener noreferrer' : undefined}
        >
            <Card position={position} onClick={onClick} className="p-4 active:bg-grey-4">
                {content}
            </Card>
        </Link>
    )
}

export default ProfileMenuItem
