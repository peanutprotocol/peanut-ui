'use client'

import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'framer-motion'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { RESIDENCE_STICKERS, residenceStickerSrc } from './residence-stickers.consts'

/** The mascot waves this long after the screen arrives before it may celebrate. */
export const RESIDENCE_WAVE_MS = 2000

/*
 * Order, size and tilt of the five decorations, from the approved mock: star,
 * sparkle, star, star, sparkle. The last sparkle is mirrored (Konrad). The
 * positions live in globals.css with the keyframes.
 */
const DECORATIONS = [star, sparkle, star, star, sparkle]

/**
 * The Residence step's hero. The mascot waves hello; when the residence is one
 * of the sticker countries it cheers, the country's three stickers are slapped
 * on one after another, and five landing-page stars and sparkles pop in.
 *
 * The celebration never starts before RESIDENCE_WAVE_MS after the hero mounts,
 * so a residence prefilled from geo gets the wave first, while a country picked
 * by hand (always later than that) celebrates at once. The layer is keyed by
 * country, so another sticker country replays the slap with its own stickers.
 * All of it is decoration: hidden from assistive tech and never a tap target.
 */
export function ResidenceHero({ alt }: { alt: string }) {
    const { residenceCountry } = useSetupFlowContext()
    const prefersReducedMotion = useReducedMotion()
    const [waved, setWaved] = useState(false)
    const stickers = RESIDENCE_STICKERS[residenceCountry]
    const celebrating = !!stickers && (waved || !!prefersReducedMotion)

    useEffect(() => {
        const timer = setTimeout(() => setWaved(true), RESIDENCE_WAVE_MS)
        // The cheering pose is its own chunk: fetch it during the wave so the swap has no empty frame.
        void MASCOT_ANIMATION_LOADERS.cheering().catch(() => {})
        return () => clearTimeout(timer)
    }, [])

    // Fetch a waiting country's stickers during the wave, so the slap does not start on empty boxes.
    useEffect(() => {
        if (!stickers || celebrating) return
        stickers.forEach((file) => {
            new window.Image().src = residenceStickerSrc(file)
        })
    }, [stickers, celebrating])

    return (
        <div className="absolute inset-0" data-residence-hero={celebrating ? residenceCountry : 'waving'}>
            <div className="absolute inset-x-0 top-16 bottom-2 flex items-center justify-center md:top-20 md:bottom-8">
                <PeanutMascot
                    pose={celebrating ? 'cheering' : 'waving-hello'}
                    alt={alt}
                    className="relative h-full max-w-full"
                />
            </div>
            {celebrating && (
                <div key={residenceCountry} aria-hidden="true" className="residence-stickers">
                    {DECORATIONS.map((src, index) => (
                        <Image
                            key={index}
                            src={src}
                            alt=""
                            draggable={false}
                            className="residence-deco"
                            data-deco={index}
                            style={{ '--i': index } as CSSProperties}
                        />
                    ))}
                    {stickers.map((file, index) => (
                        <Image
                            key={file}
                            src={residenceStickerSrc(file)}
                            alt=""
                            width={320}
                            height={320}
                            unoptimized
                            draggable={false}
                            className="residence-sticker"
                            data-sticker={index}
                            style={{ '--i': index } as CSSProperties}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
