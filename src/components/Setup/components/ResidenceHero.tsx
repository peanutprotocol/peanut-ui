'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { RESIDENCE_STICKERS, residenceStickerSrc } from './residence-stickers.consts'

/** The mascot waves this long after the screen arrives before it may celebrate. */
export const RESIDENCE_WAVE_MS = 2000

/** The slap waits this long at most for the three sticker files; a failed fetch never holds it longer. */
export const RESIDENCE_STICKER_LOAD_MS = 1500

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
 * The celebration never starts before RESIDENCE_WAVE_MS after the hero first
 * mounts, so a residence prefilled from geo gets the wave first, while a country
 * picked by hand (always later than that) celebrates at once. The wave happens
 * once per sign-up: the hero unmounts for the compare view and on Back, and
 * celebrates at once when it returns. The sticker layer mounts only when its
 * three files have loaded, so the slap never plays on empty boxes; it is keyed
 * by country, so another sticker country replays the slap with its own stickers.
 * All of it is decoration: hidden from assistive tech and never a tap target.
 */
export function ResidenceHero({ alt }: { alt: string }) {
    const { residenceCountry, residenceWaveDone } = useSetupFlowContext()
    const prefersReducedMotion = useReducedMotion()
    const [waved, setWaved] = useState(() => residenceWaveDone.current)
    const [loadedCountry, setLoadedCountry] = useState<string | null>(null)
    const stickers = RESIDENCE_STICKERS[residenceCountry]
    const celebrating = !!stickers && (waved || !!prefersReducedMotion)
    // Nothing moves under reduced motion, so there is no slap to hold back.
    const stickersReady = !!prefersReducedMotion || loadedCountry === residenceCountry

    useEffect(() => {
        if (waved) return
        const timer = setTimeout(() => {
            residenceWaveDone.current = true
            setWaved(true)
        }, RESIDENCE_WAVE_MS)
        return () => clearTimeout(timer)
    }, [waved, residenceWaveDone])

    useEffect(() => {
        if (!stickers) return
        // The cheering pose is its own chunk: fetch it ahead so the swap has no empty frame.
        void MASCOT_ANIMATION_LOADERS.cheering().catch(() => {})

        let pending = stickers.length
        const ready = () => setLoadedCountry(residenceCountry)
        // A failed or slow fetch must not hold the celebration back.
        const fallback = setTimeout(ready, RESIDENCE_STICKER_LOAD_MS)
        const settle = () => {
            pending -= 1
            if (pending > 0) return
            clearTimeout(fallback)
            ready()
        }
        const images = stickers.map((file) => {
            const image = new window.Image()
            image.onload = settle
            image.onerror = settle
            image.src = residenceStickerSrc(file)
            return image
        })
        return () => {
            clearTimeout(fallback)
            images.forEach((image) => {
                image.onload = null
                image.onerror = null
            })
        }
    }, [stickers, residenceCountry])

    return (
        <div className="absolute inset-0" data-residence-hero={celebrating ? residenceCountry : 'waving'}>
            <div className="absolute inset-x-0 top-16 bottom-2 flex items-center justify-center md:top-20 md:bottom-8">
                <PeanutMascot
                    pose={celebrating ? 'cheering' : 'waving-hello'}
                    alt={alt}
                    className="relative h-full max-w-full"
                />
            </div>
            {celebrating && stickersReady && (
                <div key={residenceCountry} aria-hidden="true" className="residence-stickers">
                    {DECORATIONS.map((src, index) => (
                        <Image
                            key={index}
                            src={src}
                            alt=""
                            draggable={false}
                            className="residence-deco"
                            data-deco={index}
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
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
