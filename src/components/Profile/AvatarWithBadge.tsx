import React from 'react'
import { twMerge } from 'tailwind-merge'
import AchievementsBadge, { AchievementsBadgeSize } from '../Global/Badges/AchievementsBadge'

interface AvatarWithBadgeProps {
    initials: string
    isVerified?: boolean
    className?: string
    size?: 'extra-small' | 'small' | 'medium' | 'large'
    achievementsBadgeSize?: AchievementsBadgeSize
}
const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
    initials,
    isVerified = false,
    className,
    size = 'medium',
    achievementsBadgeSize = 'small',
}) => {
    const sizeClasses = {
        'extra-small': 'h-8 w-8 text-sm',
        small: 'h-8 w-8 text-lg',
        medium: 'h-16 w-16 text-2xl',
        large: 'h-24 w-24 text-3xl',
    }

    return (
        <div className={twMerge('relative', className)}>
            <div
                className={twMerge(
                    `flex items-center justify-center rounded-full bg-yellow-5 font-bold`,
                    sizeClasses[size]
                )}
            >
                {initials}
            </div>
            {isVerified && <AchievementsBadge size={achievementsBadgeSize} />}
        </div>
    )
}

export default AvatarWithBadge
