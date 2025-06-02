import AvatarWithBadge from '@/components/Profile/AvatarWithBadge' // Assuming this path is correct
import Image from 'next/image'
import React, { useState } from 'react'

interface DisplayIconProps {
    iconUrl?: string
    altText: string
    fallbackName: string
    sizeClass?: string
    badgeSize?: 'extra-small' | 'small' | 'medium' | 'large'
    className?: string
}

const DisplayIcon: React.FC<DisplayIconProps> = ({
    iconUrl,
    altText,
    fallbackName,
    sizeClass = 'h-6 w-6',
    badgeSize = 'extra-small',
    className = '',
}) => {
    const [imageError, setImageError] = useState(false)

    if (iconUrl && !imageError) {
        return (
            <Image
                src={iconUrl}
                alt={altText}
                width={24}
                height={24}
                className={`${sizeClass} rounded-full ${className}`.trim()}
                onError={() => setImageError(true)}
            />
        )
    }

    // Fallback to AvatarWithBadge
    return (
        <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gray-200 ${className}`.trim()}>
            <AvatarWithBadge name={fallbackName} size={badgeSize} achievementsBadgeSize={badgeSize} />
        </div>
    )
}

export default DisplayIcon
