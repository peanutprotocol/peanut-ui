'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'
import type { AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import { twMerge } from '@/utils/tw'
import { avatarPalette, avatarSrc } from './avatar.utils'

interface UserAvatarProps {
    /** The username only. The fallback is its first character — never the
     *  full name or anything from verification, which would leak PII. */
    username?: string
    avatarKey?: string | null
    size?: AvatarSize
    className?: string
}

// board 17802:61529: XS 24 · S 32 · M 48 · L 64 (+ the code-only 96), circle,
// 1px border. Same boxes and type steps as AvatarWithBadge.
const SIZE_CLASSES: Record<AvatarSize, string> = {
    tiny: 'size-6 text-label-m',
    'extra-small': 'size-8 text-label-m',
    small: 'size-12 text-body-m-semibold',
    medium: 'size-16 text-heading-s',
    large: 'size-24 text-heading-m',
}
const SIZE_PX: Record<AvatarSize, number> = { tiny: 24, 'extra-small': 32, small: 48, medium: 64, large: 96 }
const ICON_PX: Record<AvatarSize, number> = { tiny: 12, 'extra-small': 16, small: 18, medium: 32, large: 48 }

/**
 * The user's own avatar: their picked character on its palette triple, or
 * the privacy-safe fallback — one username initial on the username's color.
 */
export function UserAvatar({ username, avatarKey, size = 'extra-small', className }: UserAvatarProps) {
    const t = useTranslations('common')
    const src = avatarSrc(avatarKey)
    const initial = username?.trim().charAt(0).toUpperCase() || ''
    // the seven triples travel together (fill, border, foreground); no-username
    // resolves to the palette's yellow default, like the rest of the app
    const palette = src && avatarKey ? avatarPalette(avatarKey) : getColorForUsername(initial ? username : undefined)

    return (
        <span
            className={twMerge(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
                SIZE_CLASSES[size],
                className
            )}
            style={{ background: palette.lightShade, borderColor: palette.borderShade, color: palette.darkShade }}
            {...(username ? { role: 'img', 'aria-label': t('userAvatarAlt', { username }) } : { 'aria-hidden': true })}
        >
            {src ? (
                <Image
                    src={src}
                    alt=""
                    width={SIZE_PX[size]}
                    height={SIZE_PX[size]}
                    unoptimized
                    className="size-[82%]"
                />
            ) : initial ? (
                initial
            ) : (
                <Icon name="user" size={ICON_PX[size]} />
            )}
        </span>
    )
}
