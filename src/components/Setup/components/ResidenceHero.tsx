'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { RESIDENCE_STICKERS, residenceStickerSrc } from './residence-stickers.consts'

/** The mascot waves this long after the screen arrives before it may celebrate. */
export const RESIDENCE_WAVE_MS = 2000

/** The stickers wait this long at most for their files; a failed fetch never holds them longer. */
export const RESIDENCE_STICKER_LOAD_MS = 1500

/** A country picked by hand waits this long, so the first slap is not hidden by the closing picker. */
export const RESIDENCE_PICK_DELAY_MS = 400

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
 * picked by hand celebrates once the picker has closed. The wave happens
 * once per sign-up: the hero unmounts for the compare view and on Back, and
 * celebrates at once when it returns. The mascot keeps waving until the
 * cheering pose has loaded, with no time limit, so it never blanks. The slap
 * waits for the pose and the three sticker files, at most
 * RESIDENCE_STICKER_LOAD_MS; a sticker whose file fails is left out. The
 * sticker layer is keyed by country, so another sticker country replays the
 * slap with its own stickers.
 *
 * Both poses are drawn on one shared canvas box (as in the approved mock), so
 * the mascot keeps its size and its ground line when the pose changes. Layout
 * and motion live in globals.css (`.residence-*`).
 * All of it is decoration: hidden from assistive tech and never a tap target.
 */
export function ResidenceHero({ alt }: { alt: string }) {
    const { residenceCountry, residenceWaveDone } = useSetupFlowContext()
    const prefersReducedMotion = useReducedMotion()
    const [waved, setWaved] = useState(() => residenceWaveDone.current)
    const [loadedCountry, setLoadedCountry] = useState<string | null>(null)
    // The mascot leaves the wave only when the cheering pose can be drawn, however long that takes.
    const [poseReady, setPoseReady] = useState(false)
    const [failedStickers, setFailedStickers] = useState<readonly string[]>([])
    const hideSticker = useCallback(
        (file: string) => setFailedStickers((failed) => (failed.includes(file) ? failed : [...failed, file])),
        []
    )
    const stickers = RESIDENCE_STICKERS[residenceCountry]
    const celebrating = !!stickers && (waved || !!prefersReducedMotion)
    // A hero that mounts already celebrating (reduced motion, or back from the
    // compare view) draws its final state on the first paint, with no wave first.
    const mountedCelebrating = useRef(celebrating).current
    const mountedCountry = useRef(residenceCountry).current
    // Nothing moves under reduced motion, so only the pose itself is waited for.
    const cheering =
        celebrating && poseReady && (!!prefersReducedMotion || mountedCelebrating || loadedCountry !== null)
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
        if (!stickers) {
            setLoadedCountry(null)
            return
        }
        let cancelled = false
        // The three stickers and the cheering pose, which is its own chunk.
        let pending = stickers.length + 1
        // A country that arrives after the mount may have been picked by hand, with the picker
        // still closing. During the wave too: a pick just before its end must not slap early.
        let held = residenceCountry !== mountedCountry
        const ready = () => setLoadedCountry(residenceCountry)
        // A failed or slow fetch must not hold the stickers back. The pose is not on this clock.
        const fallback = setTimeout(ready, RESIDENCE_STICKER_LOAD_MS)
        const start = () => {
            if (cancelled || pending > 0 || held) return
            clearTimeout(fallback)
            ready()
        }
        const settle = () => {
            pending -= 1
            start()
        }
        const hold = held
            ? setTimeout(() => {
                  held = false
                  start()
              }, RESIDENCE_PICK_DELAY_MS)
            : undefined
        void MASCOT_ANIMATION_LOADERS.cheering().then(() => {
            setPoseReady(true)
            settle()
        }, settle)
        // The same URL the layer renders below, so each sticker is fetched once.
        const images = stickers.map((file) => {
            const image = new window.Image()
            image.onload = settle
            image.onerror = () => {
                hideSticker(file)
                settle()
            }
            image.src = residenceStickerSrc(file)
            return image
        })
        return () => {
            cancelled = true
            clearTimeout(fallback)
            clearTimeout(hold)
            images.forEach((image) => {
                image.onload = null
                image.onerror = null
            })
        }
    }, [stickers, residenceCountry, mountedCountry, hideSticker])

    return (
        <div className="residence-hero" data-residence-hero={cheering ? residenceCountry : 'waving'}>
            <div className="residence-scene">
                <div className="residence-mascot">
                    <PeanutMascot
                        pose={cheering ? 'cheering' : 'waving-hello'}
                        alt={alt}
                        fit="canvas"
                        className="size-full"
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
                        {/* A plain img: next/image adds a deploy query, which would be a second fetch. */}
                        {stickers.map((file, index) =>
                            failedStickers.includes(file) ? null : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={file}
                                    src={residenceStickerSrc(file)}
                                    alt=""
                                    width={320}
                                    height={320}
                                    draggable={false}
                                    onError={() => hideSticker(file)}
                                    className="residence-sticker"
                                    data-sticker={index}
                                />
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
