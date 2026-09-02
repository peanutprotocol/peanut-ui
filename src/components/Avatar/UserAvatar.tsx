'use client'

import Image from 'next/image'
import AvatarWithBadge, { type AvatarSize } from '@/components/Profile/AvatarWithBadge'
import { twMerge } from '@/utils/tw'
import { avatarPalette, avatarSrc } from './avatar.utils'

interface UserAvatarProps {
    /** Display name for the fallback; AvatarWithBadge shows its first letter. */
    name?: string
    avatarKey?: string | null
    size?: AvatarSize
    className?: string
}

// board 17802:61529: XS 24 · S 32 · M 48 · L 64 (+ the code-only 96), circle,
// 1px border — the same boxes AvatarWithBadge draws.
const SIZE_CLASSES: Record<AvatarSize, string> = {
    tiny: 'size-6',
    'extra-small': 'size-8',
    small: 'size-12',
    medium: 'size-16',
    large: 'size-24',
}
const SIZE_PX: Record<AvatarSize, number> = { tiny: 24, 'extra-small': 32, small: 48, medium: 64, large: 96 }

/**
 * The user's own avatar (TASK-22142): the picked character on its palette
 * triple. Without a pick — or with a key the manifest does not know — it is
 * exactly the existing first-letter avatar, so the fallback lives in one place.
 */
export function UserAvatar({ name, avatarKey, size = 'extra-small', className }: UserAvatarProps) {
    const src = avatarSrc(avatarKey)
    if (!src || !avatarKey) {
        return name ? (
            <AvatarWithBadge size={size} name={name} firstLetterOnly className={className} />
        ) : (
            <AvatarWithBadge
                size={size}
                icon="user"
                className={twMerge(
                    'border border-avatar-yellow-border bg-avatar-yellow text-avatar-yellow-foreground',
                    className
                )}
                iconFillColor="var(--color-avatar-yellow-foreground)"
            />
        )
    }

    // the seven triples travel together (fill, border, foreground)
    const palette = avatarPalette(avatarKey)
    return (
        <span
            aria-hidden
            className={twMerge(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
                SIZE_CLASSES[size],
                className
            )}
            style={{ background: palette.lightShade, borderColor: palette.borderShade }}
        >
            <Image src={src} alt="" width={SIZE_PX[size]} height={SIZE_PX[size]} unoptimized className="size-[82%]" />
        </span>
    )
}
