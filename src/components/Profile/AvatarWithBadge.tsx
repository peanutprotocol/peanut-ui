import { getInitialsFromName } from '@/utils'
import { getColorForUsername } from '@/utils/color.utils'
import React, { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, IconName } from '../Global/Icons/Icon'
import StatusPill, { StatusPillType } from '../Global/StatusPill'
import Image, { type StaticImageData } from 'next/image'

export type AvatarSize = 'extra-small' | 'small' | 'medium' | 'large'

/**
 * props for the avatarwithbadge component.
 */
interface AvatarWithBadgeProps {
    name?: string
    icon?: IconName
    className?: string
    size?: AvatarSize
    inlineStyle?: React.CSSProperties // for dynamic background colors based on username (hex codes)
    textColor?: string
    iconFillColor?: string
    logo?: StaticImageData
}

/**
 * component to display an avatar circle with either initials or an icon,
 * and optionally a verification badge.
 */
const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
    name,
    icon,
    className,
    size = 'medium',
    inlineStyle,
    textColor,
    iconFillColor,
    logo,
}) => {
    const sizeClasses: Record<AvatarSize, string> = {
        'extra-small': 'h-8 w-8 text-xs',
        small: 'h-12 w-12 text-sm',
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

    if (logo) {
        return (
            <div className={'relative'}>
                <div
                    className={twMerge(
                        `flex items-center justify-center rounded-full font-bold`,
                        sizeClasses[size],
                        className
                    )}
                >
                    <Image
                        src={logo}
                        alt={name ? `${name} logo` : 'logo'}
                        width={160}
                        height={160}
                        className={`size-full rounded-full object-cover`}
                    />
                </div>
            </div>
        )
    }

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
                    background: name ? getColorForUsername(name).lightShade : undefined,
                    border: name && !icon ? `1px solid ${getColorForUsername(name).darkShade}` : undefined,
                    color: name ? getColorForUsername(name).darkShade : !icon ? textColor : undefined,
                    ...inlineStyle,
                }}
            >
                {logo && (
                    <Image
                        src={logo}
                        alt={''}
                        width={160}
                        height={160}
                        className={`size-[${iconSizeMap[size]}] rounded-full object-cover`}
                    />
                )}
                {/* display icon if provided, otherwise display initials */}
                {icon ? (
                    <Icon name={icon} size={iconSizeMap[size]} fill={iconFillColor} style={{ color: textColor }} />
                ) : (
                    initials
                )}
            </div>
        </div>
    )
}

export default AvatarWithBadge
