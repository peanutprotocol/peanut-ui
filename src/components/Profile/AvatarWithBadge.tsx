import { getInitialsFromName } from '@/utils'
import { getColorForUsername } from '@/utils/color.utils'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import AchievementsBadge, { AchievementsBadgeSize } from '../Global/Badges/AchievementsBadge'
import { Icon, IconName } from '../Global/Icons/Icon'

type AvatarSize = 'extra-small' | 'small' | 'medium' | 'large'

/**
 * props for the avatarwithbadge component.
 */
interface AvatarWithBadgeProps {
    name?: string
    icon?: IconName
    isVerified?: boolean
    className?: string
    size?: AvatarSize
    achievementsBadgeSize?: AchievementsBadgeSize
    inlineStyle?: React.CSSProperties // for dynamic background colors based on username (hex codes)
    textColor?: string
    iconFillColor?: string
}

/**
 * component to display an avatar circle with either initials or an icon,
 * and optionally a verification badge.
 */
const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
    name,
    icon,
    isVerified = false,
    className,
    size = 'medium',
    achievementsBadgeSize = 'small',
    inlineStyle,
    textColor,
    iconFillColor,
}) => {
    const sizeClasses: Record<AvatarSize, string> = {
        'extra-small': 'h-8 w-8 text-xs',
        small: 'h-10 w-10 text-sm',
        medium: 'h-16 w-16 text-2xl',
        large: 'h-24 w-24 text-3xl',
    }

    const iconSizeMap: Record<AvatarSize, number> = {
        'extra-small': 16,
        small: 18,
        medium: 32,
        large: 48,
    }

    const initials = useMemo(() => {
        if (name) {
            return getInitialsFromName(name)
        }
        return ''
    }, [name])

    return (
        <div className={'relative'}>
            {/* the main avatar circle */}
            <div
                className={twMerge(
                    `flex items-center justify-center rounded-full font-bold`,
                    sizeClasses[size],
                    className
                )}
                // apply dynamic styles (e.g., background color)

                style={{
                    background: name ? getColorForUsername(name).backgroundColor : undefined,
                    ...inlineStyle,
                    color: !icon ? textColor : undefined,
                }}
            >
                {/* display icon if provided, otherwise display initials */}
                {icon ? (
                    <Icon name={icon} size={iconSizeMap[size]} fill={iconFillColor} style={{ color: textColor }} />
                ) : (
                    initials
                )}
            </div>
            {/* display verification badge if isverified is true */}
            {isVerified && <AchievementsBadge size={achievementsBadgeSize} />}
        </div>
    )
}

export default AvatarWithBadge
