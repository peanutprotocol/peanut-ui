import StatusBadge from '@/components/Global/Badges/StatusBadge'
import Card, { CardPosition } from '@/components/Global/Card'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import Link from 'next/link'
import React from 'react'

interface ProfileMenuItemProps {
    icon: IconName
    label: string
    href?: string
    onClick?: () => void
    position?: CardPosition
    comingSoon?: boolean
}

const ProfileMenuItem: React.FC<ProfileMenuItemProps> = ({
    icon,
    label,
    href,
    onClick,
    position = 'middle',
    comingSoon = false,
}) => {
    const content = (
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
                <Icon name={icon} size={20} fill="black" />
                <span className="text-base font-medium">{label}</span>
            </div>

            <div className="flex items-center">
                {comingSoon ? (
                    <StatusBadge status="soon" size="medium" />
                ) : (
                    <Icon name="chevron-up" size={24} fill="black" className="rotate-90" />
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

    return (
        <Link href={href} className="block">
            <Card position={position} onClick={onClick} className="p-4 hover:bg-grey-4">
                {content}
            </Card>
        </Link>
    )
}

export default ProfileMenuItem
