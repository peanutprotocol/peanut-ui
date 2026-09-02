'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '@/components/Profile/avatar-size.consts'
import { twMerge } from '@/utils/tw'
import { avatarPaletteClass, avatarSrc } from './avatar.utils'

interface UserAvatarProps {
    /** Display name for the fallback; AvatarWithBadge shows its first letter. */
    name?: string
    avatarKey?: string | null
    size?: AvatarSize
    className?: string
}

/**
 * The user's own avatar (TASK-22142): the picked character on its palette
 * triple. Without a pick, or with a key the manifest does not know, it is
 * exactly the existing first-letter avatar, so the fallback lives in one place.
 */
export function UserAvatar({ name, avatarKey, size = 'extra-small', className }: UserAvatarProps) {
    const t = useTranslations('common')
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

    return (
        <span
            {...(name
                ? { role: 'img', 'aria-label': t('userAvatarAlt', { username: name }) }
                : { 'aria-hidden': true })}
            className={twMerge(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
                avatarPaletteClass(avatarKey),
                AVATAR_SIZE_CLASSES[size],
                className
            )}
        >
            <Image src={src} alt="" width={96} height={96} unoptimized className="size-[82%]" />
        </span>
    )
}
