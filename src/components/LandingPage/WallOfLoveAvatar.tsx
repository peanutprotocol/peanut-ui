'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { WallOfLoveAvatarProps } from './homeWallOfLove.types'

/** The author's X picture, or their initial when the picture is gone (X rotates them, many 404). */
export function WallOfLoveAvatar({ post }: WallOfLoveAvatarProps) {
    const [failed, setFailed] = useState(false)
    if (!post.avatar || failed) {
        return (
            <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-950 text-label-m text-foreground-inverse"
            >
                {post.author[0]?.toUpperCase()}
            </span>
        )
    }
    return (
        <Image
            src={post.avatar}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
            onError={() => setFailed(true)}
        />
    )
}
