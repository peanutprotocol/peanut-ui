'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

// size-8 for the activity row, size-12 for the receipt header — the two slots
// that otherwise draw the generic card badge. Literal classes so Tailwind's JIT
// keeps them.
const SIZES = {
    sm: { box: 'size-8', px: 32 },
    md: { box: 'size-12', px: 48 },
} as const

interface MerchantLogoIconProps {
    src: string
    /** Shown when the logo URL fails to load, so a broken URL never renders a
     *  broken-image glyph. For a card-spend row this is the generic card badge. */
    fallback: ReactNode
    size?: keyof typeof SIZES
}

/**
 * Round leading image for a card-spend row — the merchant's own brand logo,
 * enriched by Rain. Mirrors the avatar-image treatment in TransactionCard but
 * uses object-cover so a rectangular logo fills the circle. Falls back to the
 * generic card badge on a load error.
 */
export function MerchantLogoIcon({ src, fallback, size = 'sm' }: MerchantLogoIconProps) {
    const [failed, setFailed] = useState(false)

    if (failed) return <>{fallback}</>

    const { box, px } = SIZES[size]

    return (
        <div className={twMerge('relative flex items-center justify-center overflow-hidden rounded-full', box)}>
            <Image
                src={src}
                alt="Merchant logo"
                className={twMerge('object-cover', box)}
                width={px}
                height={px}
                onError={() => setFailed(true)}
            />
        </div>
    )
}
