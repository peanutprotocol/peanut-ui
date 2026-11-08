import { getInitialsFromName } from '@/utils/general.utils'
import { getColorForUsername } from '@/utils/color.utils'
import React, { useMemo, useState } from 'react'
import { twMerge } from '@/utils/tw'
import { Icon, type IconName } from '../Global/Icons/Icon'
import Image, { type StaticImageData } from 'next/image'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from './avatar-size.consts'

export type { AvatarSize }

// half the box, the same glyph-to-bubble ratio as IconBubble s and xl
const ICON_SIZES: Record<AvatarSize, number> = {
    s: 16,
    xl: 48,
}

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
     * provide a semantic fallback (e.g. a bank row's bank IconBubble) instead
     * of a generic broken-image placeholder when an obscure flag / merchant
     * logo is missing.
     */
    fallback?: React.ReactNode
}

/**
 * component to display an avatar circle with either initials or an icon,
 * and optionally a verification badge.
 */
const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
    name,
    icon,
    className,
    size = 's',
    inlineStyle,
    textColor,
    iconFillColor,
    logo,
    fallback,
    firstLetterOnly,
}) => {
    const [logoFailed, setLogoFailed] = useState(false)

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
                    {/* with no name the logo is decorative (a flag beside its own
                        text): an empty alt, not an English "logo" in every locale */}
                    <Image
                        src={logo}
                        alt={name ? `${name} logo` : ''}
                        width={160}
                        height={160}
                        className={`size-full rounded-full object-cover`}
                        onError={() => setLogoFailed(true)}
                    />
                </div>
            </div>
        )
    }

    // the logo failed and the caller supplied a semantic fallback: render it
    if (logoFailed && fallback) return <>{fallback}</>

    const nameColors = name ? getColorForUsername(name) : undefined

    return (
        <div className={'relative'}>
            {/* the main avatar circle */}
            <div
                className={twMerge(
                    // no font-weight here: the size classes carry the type
                    // tokens' own weights (Label/M and Heading/M are both 800),
                    // and a blanket bold would render them at 700.
                    `flex items-center justify-center rounded-full`,
                    AVATAR_SIZE_CLASSES[size],
                    className
                )}
                // apply dynamic styles (e.g., background color)

                style={{
                    background: nameColors?.lightShade,
                    border: nameColors && !icon ? `1px solid ${nameColors.borderShade}` : undefined,
                    color: nameColors ? nameColors.darkShade : !icon ? textColor : undefined,
                    ...inlineStyle,
                }}
            >
                {/* display icon if provided, otherwise display initials */}
                {icon ? (
                    <Icon name={icon} size={ICON_SIZES[size]} fill={iconFillColor} style={{ color: textColor }} />
                ) : (
                    initials
                )}
            </div>
        </div>
    )
}

export default AvatarWithBadge
