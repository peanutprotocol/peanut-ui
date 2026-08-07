'use client'

import Image, { type ImageProps } from 'next/image'
import { useEffect, useState } from 'react'
import { getBadgeIcon } from './badge.utils'

/**
 * Badge artwork can come from the backend catalog. Keep the earned badge
 * visible when that remote asset is missing or temporarily unavailable by
 * swapping only the failed image to generic Peanut artwork.
 */
export const BadgeImage = ({ src, onError, unoptimized = true, ...props }: ImageProps) => {
    const [resolvedSrc, setResolvedSrc] = useState<ImageProps['src']>(src)
    const genericSrc = getBadgeIcon()

    useEffect(() => setResolvedSrc(src), [src])

    return (
        <Image
            {...props}
            src={resolvedSrc}
            unoptimized={unoptimized}
            onError={(event) => {
                if (resolvedSrc !== genericSrc) setResolvedSrc(genericSrc)
                onError?.(event)
            }}
        />
    )
}
