'use client'

import type { AvatarSize } from '@/components/Profile/avatar-size.consts'
import type { Person } from '@/lib/person/person.types'
import { AvatarSticker } from './AvatarSticker'

interface UserAvatarProps {
    /** Built by `personFrom`: the only way a surface gets a person's pick (TASK-23756). */
    person: Person
    size?: AvatarSize
    className?: string
    /**
     * Drops the avatar from the accessibility tree. Use wherever the same name
     * is already on screen next to the avatar — a list row, a receipt header —
     * so a screen reader announces the person once instead of twice.
     */
    decorative?: boolean
}

/** A person's avatar: their pick, else their handle's letter. */
export function UserAvatar({ person, size, className, decorative }: UserAvatarProps) {
    return (
        <AvatarSticker
            avatarKey={person.avatarKey}
            letterOf={person.username}
            size={size}
            className={className}
            decorative={decorative}
        />
    )
}
