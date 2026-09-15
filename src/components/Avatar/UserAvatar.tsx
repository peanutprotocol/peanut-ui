'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '@/components/Profile/avatar-size.consts'
import { twMerge } from '@/utils/tw'
import { avatarSrc, letterAvatarSrc } from './avatar.utils'

interface UserAvatarProps {
    /** Display name: the source of the day-0 letter sticker and of the label. */
    name?: string
    avatarKey?: string | null
    size?: AvatarSize
    className?: string
    /**
     * Keeps `name` (the letter sticker is derived from it) but drops the avatar
     * from the accessibility tree. Use wherever the same name is already on
     * screen next to the avatar — a list row, a receipt header — so a screen
     * reader announces the person once instead of twice.
     */
    decorative?: boolean
}

/**
 * The user's own avatar (TASK-22142): the picked sticker, plain on the page —
 * a sticker carries its own colours and edge, so no circle and no palette ring
 * (art direction, 2026-09-03). Without a pick, the first letter of the name as
 * a sticker. A name that does not start with a-z falls through to the
 * first-letter avatar, which stays the one place that renders a bare initial.
 */
export function UserAvatar({ name, avatarKey, size = 'extra-small', className, decorative }: UserAvatarProps) {
    const t = useTranslations('common')
    const picked = avatarKey ? avatarSrc(avatarKey) : null
    const letter = picked ? null : letterAvatarSrc(name)
    const art = picked ?? letter

    if (!art) {
        const initialsAvatar = name ? (
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
        // `contents` so hiding the initials costs no box of its own.
        return decorative ? (
            <div className="contents" aria-hidden>
                {initialsAvatar}
            </div>
        ) : (
            initialsAvatar
        )
    }

    return (
        <span
            {...(name && !decorative
                ? { role: 'img', 'aria-label': t('userAvatarAlt', { username: name }) }
                : { 'aria-hidden': true })}
            className={twMerge(
                'inline-flex shrink-0 items-center justify-center',
                AVATAR_SIZE_CLASSES[size],
                className
            )}
        >
            <Image src={art} alt="" width={176} height={176} unoptimized className="size-full object-contain" />
        </span>
    )
}
