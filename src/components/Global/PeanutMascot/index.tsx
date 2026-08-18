'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { MASCOT_ANIMATION_LOADERS, MASCOT_ART_BOXES, MASCOT_HOLD_FRAMES, MASCOT_SPEED } from './PeanutMascot.consts'
import type { MascotPlacement, PeanutMascotProps } from './PeanutMascot.types'
import { getMascotPlacement, jitterFrame, subscribeToMascotClock } from './PeanutMascot.utils'

export default function PeanutMascot({ pose, className, alt, loop = true }: PeanutMascotProps) {
    const hostRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    // Survives visibility toggles: scrolling a mascot out and back should resume the loop,
    // not restart it — and a loop={false} one-shot must not replay on every re-entry.
    const virtualFrame = useRef(0)
    const [animation, setAnimation] = useState<AnimationItem | null>(null)
    const [placement, setPlacement] = useState<MascotPlacement | null>(null)
    const [isVisible, setIsVisible] = useState(true)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    // lottie-web touches `document`, so it loads on the client only. The comp is loaded per
    // pose, so a screen downloads the one animation it shows instead of all ten.
    useEffect(() => {
        const container = stageRef.current
        if (!container) return
        let cancelled = false
        let instance: AnimationItem | null = null

        void Promise.all([import('lottie-web/build/player/lottie_light'), MASCOT_ANIMATION_LOADERS[pose]()])
            .then(([lottie, animationData]) => {
                if (cancelled) return
                instance = lottie.default.loadAnimation({
                    container,
                    renderer: 'svg',
                    loop,
                    autoplay: false,
                    animationData: animationData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                setAnimation(instance)
            })
            // A failed chunk here must not escape. The app installs a global
            // unhandledrejection handler that reloads the page on ChunkLoadError, so an
            // uncaught rejection would reload a payment-success screen — discarding its
            // state — because a decorative mascot could not be fetched. The old <img>
            // failed silently and so does this: the box stays empty.
            .catch(() => {})

        return () => {
            cancelled = true
            instance?.destroy()
            setAnimation(null)
        }
    }, [pose, loop])

    // Size from the artwork, not the canvas: the per-pose padding differs, so canvas sizing
    // renders each pose at a different apparent size in the same box.
    useEffect(() => {
        const host = hostRef.current
        if (!host) return
        const measure = () => setPlacement(getMascotPlacement(pose, host.clientWidth, host.clientHeight))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(host)
        return () => observer.disconnect()
    }, [pose])

    useEffect(() => {
        const host = hostRef.current
        if (!host) return
        const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting))
        observer.observe(host)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        setPrefersReducedMotion(query.matches)
        const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    // The vintage stutter: hold each frame instead of playing smoothly, on a clock we drive.
    useEffect(() => {
        if (!animation) return
        if (prefersReducedMotion) {
            animation.goToAndStop(0, true)
            return
        }
        // Offscreen: hold whatever frame is showing rather than burn a tick on it.
        if (!isVisible) return

        const totalFrames = animation.totalFrames || 1
        let shownFrame = -1
        let stop = () => {}

        stop = subscribeToMascotClock((deltaSeconds) => {
            virtualFrame.current += deltaSeconds * animation.frameRate * MASCOT_SPEED
            if (virtualFrame.current >= totalFrames) {
                if (!loop) {
                    animation.goToAndStop(totalFrames - 1, true)
                    stop()
                    return
                }
                virtualFrame.current -= totalFrames
            }
            const heldFrame = Math.floor(virtualFrame.current / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
            if (heldFrame === shownFrame) return
            shownFrame = heldFrame
            animation.goToAndStop(jitterFrame(heldFrame, totalFrames), true)
        })

        return () => stop()
    }, [animation, isVisible, loop, prefersReducedMotion])

    const art = MASCOT_ART_BOXES[pose]

    return (
        <div
            ref={hostRef}
            className={twMerge('relative overflow-hidden', className)}
            // The artwork's own aspect, so a call site can give a height alone and get a box
            // the pose actually fits — every pose then renders at that height instead of the
            // wide ones coming out short. Ignored when the classes make both dimensions
            // definite, so square boxes are unaffected.
            style={{ aspectRatio: art.w / art.h }}
            role={alt ? 'img' : undefined}
            aria-label={alt || undefined}
            aria-hidden={alt ? undefined : true}
        >
            <div ref={stageRef} className="pointer-events-none absolute" style={placement ?? { width: 0, height: 0 }} />
        </div>
    )
}
