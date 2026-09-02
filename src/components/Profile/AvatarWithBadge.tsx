import { getInitialsFromName } from '@/utils/general.utils'
import { getColorForUsername } from '@/utils/color.utils'
import React, { useMemo, useState } from 'react'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'
import Image, { type StaticImageData } from 'next/image'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from './avatar-size.consts'

export type { AvatarSize }

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
    logo?: string | StaticImageData
    /**
     * The user's own avatar (home chip, self profile header) shows the first
     * letter of the username only; contacts keep two-letter initials.
     */
    firstLetterOnly?: boolean
    /**
     * Rendered when `logo` fails to load (next/image onError). Lets a parent
     * provide a semantic fallback (e.g. bank tx → bank icon on dark bg)
     * instead of a generic broken-image placeholder when an obscure flag /
     * merchant logo is missing.
     */
    fallback?: { icon: IconName; bgColor?: string; iconFillColor?: string }
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
    fallback,
    firstLetterOnly,
}) => {
    const [logoFailed, setLogoFailed] = useState(false)
    const iconSizeMap: Record<AvatarSize, number> = {
        tiny: 12,
        'extra-small': 16,
        small: 18,
        medium: 32,
        large: 48,
    }

    const initials = useMemo(() => {
        if (!name) return ''
        return firstLetterOnly ? name.trim().charAt(0).toUpperCase() : getInitialsFromName(name)
    }, [name, firstLetterOnly])

    if (logo && !logoFailed) {
        return (
            <div className={'relative'}>
                <div
                    className={twMerge(
                        `flex items-center justify-center rounded-full`,
                        AVATAR_SIZE_CLASSES[size],
                        className
                    )}
                >
                    <Image
                        src={logo}
                        alt={name ? `${name} logo` : 'logo'}
                        width={160}
                        height={160}
                        className={`size-full rounded-full object-cover`}
                        onError={() => setLogoFailed(true)}
                    />
                </div>
            </div>
        )
    }

    // When the logo fails AND the caller supplied a `fallback`, prefer that
    // semantic visual (icon + colors) over whatever icon/colors were originally
    // passed for the no-logo case.
    const nameColors = name ? getColorForUsername(name) : undefined
    const useFallback = logoFailed && fallback
    const effectiveIcon = useFallback ? fallback.icon : icon
    const effectiveIconFill = useFallback && fallback.iconFillColor ? fallback.iconFillColor : iconFillColor
    const effectiveTextColor = useFallback && fallback.iconFillColor ? fallback.iconFillColor : textColor
    const effectiveInlineStyle = useFallback && fallback.bgColor ? { backgroundColor: fallback.bgColor } : inlineStyle

    return (
        <div className={'relative'}>
            {/* the main avatar circle */}
            <div
                className={twMerge(
                    // no font-weight here: the size classes carry the board
                    // weights (Label/M is 800, Body/M-SemiBold 600, Heading/S
                    // 800) and a blanket bold rendered all three at 700.
                    `flex items-center justify-center rounded-full`,
                    AVATAR_SIZE_CLASSES[size],
                    className
                )}
                // apply dynamic styles (e.g., background color)

                style={{
                    background: nameColors?.lightShade,
                    border: nameColors && !effectiveIcon ? `1px solid ${nameColors.borderShade}` : undefined,
                    color: nameColors ? nameColors.darkShade : !effectiveIcon ? effectiveTextColor : undefined,
                    ...effectiveInlineStyle,
                }}
            >
                {/* display icon if provided, otherwise display initials */}
                {effectiveIcon ? (
                    <Icon
                        name={effectiveIcon}
                        size={iconSizeMap[size]}
                        fill={effectiveIconFill}
                        style={{ color: effectiveTextColor }}
                    />
                ) : (
                    initials
                )}
            </div>
        </div>
    )
}

export default AvatarWithBadge
