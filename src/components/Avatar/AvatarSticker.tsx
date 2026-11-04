'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '@/components/Profile/avatar-size.consts'
import { twMerge } from '@/utils/tw'
import { avatarSrc, letterAvatarSrc } from './avatar.utils'
import { useAvatarArt } from './useAvatarArt'

interface AvatarStickerProps {
    avatarKey: string | null
    /**
     * The name whose first letter is the day-0 sticker and which the label
     * names. Empty renders the generic user glyph and no label: the picker's
     * candidate tiles are art, not a person.
     */
    letterOf: string
    size?: AvatarSize
    className?: string
    /**
     * Keeps `letterOf` (the letter sticker is derived from it) but drops the avatar
     * from the accessibility tree. Use wherever the same name is already on
     * screen next to the avatar — a list row, a receipt header — so a screen
     * reader announces the person once instead of twice.
     */
    decorative?: boolean
}

/**
 * The key-level renderer behind `UserAvatar`. Only `UserAvatar` and the picker
 * may use it: every other surface shows a `Person` (TASK-23756).
 *
 * The user's own avatar (TASK-22142): the picked sticker, plain on the page —
 * a sticker carries its own colours and edge, so no circle and no palette ring
 * (art direction, 2026-09-03). Without a pick, the first letter of the name as
 * a sticker. A name that does not start with a-z falls through to the
 * first-letter avatar, which stays the one place that renders a bare initial.
 * Art that fails to load renders that same initials avatar.
 */
export function AvatarSticker({ avatarKey, letterOf, size = 's', className, decorative }: AvatarStickerProps) {
    const t = useTranslations('common')
    const served = useAvatarArt()
    const picked = avatarKey ? avatarSrc(avatarKey, served) : null
    const letter = picked ? null : letterAvatarSrc(letterOf, served)
    const art = picked ?? letter
    // keyed by url, so new art gets its own try
    const [failedArt, setFailedArt] = useState<string | null>(null)

    if (!art || art === failedArt) {
        const initialsAvatar = letterOf ? (
            <AvatarWithBadge size={size} name={letterOf} firstLetterOnly className={className} />
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
            {...(letterOf && !decorative
                ? { role: 'img', 'aria-label': t('userAvatarAlt', { username: letterOf }) }
                : { 'aria-hidden': true })}
            className={twMerge(
                'inline-flex shrink-0 items-center justify-center',
                AVATAR_SIZE_CLASSES[size],
                className
            )}
        >
            <Image
                src={art}
                alt=""
                width={176}
                height={176}
                unoptimized
                className="size-full object-contain"
                onError={() => setFailedArt(art)}
            />
        </span>
    )
}
