'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '@/components/Profile/avatar-size.consts'
import { twMerge } from '@/utils/tw'
import { avatarPaletteClass, avatarSrc, letterAvatarSrc } from './avatar.utils'

interface UserAvatarProps {
    /** Display name: the source of the day-0 letter sticker and of the label. */
    name?: string
    avatarKey?: string | null
    size?: AvatarSize
    className?: string
}

/**
 * The user's own avatar (TASK-22142): the picked character on its palette
 * triple. Without a pick, the first letter of the name as a sticker, keyed on
 * the name so the colour is stable before anything is picked. A name that does
 * not start with a-z falls through to the first-letter avatar, which stays the
 * one place that renders a bare initial.
 */
export function UserAvatar({ name, avatarKey, size = 'extra-small', className }: UserAvatarProps) {
    const t = useTranslations('common')
    const picked = avatarKey ? avatarSrc(avatarKey) : null
    const letter = picked ? null : letterAvatarSrc(name)
    // the palette is keyed on whatever identifies the art: the pick, or the
    // name behind the letter
    const art =
        picked && avatarKey
            ? { src: picked, paletteKey: avatarKey }
            : letter && name
              ? { src: letter, paletteKey: name }
              : null

    if (!art) {
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
                avatarPaletteClass(art.paletteKey),
                AVATAR_SIZE_CLASSES[size],
                className
            )}
        >
            <Image src={art.src} alt="" width={96} height={96} unoptimized className="size-[82%]" />
        </span>
    )
}
