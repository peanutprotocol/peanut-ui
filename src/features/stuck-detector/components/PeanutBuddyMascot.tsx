'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import {
    MASCOT_ANIMATION_LOADERS,
    MASCOT_HOLD_FRAMES,
    MASCOT_SPEED,
} from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { jitterFrame, subscribeToMascotClock } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import {
    applyRigMorphStep,
    collectSharedRigPairs,
    computeFootPlantSquash,
    restoreRigTransforms,
    type RigLayerPair,
} from '../rigMorph'
import type { StuckBuddyPose } from '../types'

const WALK_DURATION_MS = 820
const MORPH_DURATION_MS = 420

export type BuddyMotionPhase = 'loading' | 'walking' | 'morphing' | 'idle'

interface PeanutBuddyMascotProps {
    targetPose: StuckBuddyPose
    /** Fired as soon as Peanut finishes the walk→pose morph and lands. */
    onLanded?: () => void
    /** Optional alt text; defaults to decorative (`aria-hidden`). */
    alt?: string
}

/**
 * Dual-rig Lottie mascot player for the walking Peanut buddy:
 *   1. Plays `walking` with Peanut's vintage stutter (`hold=2`, `1.30x`) while sliding in.
 *   2. Freezes both stacked SVGs and tweens all 13 shared rig layers into `targetPose`
 *      (`waving-hello`, `worried`, `thinking`, or `sad`) with weighted foot-plant squash
 *      and a crisp 1-frame midpoint art cut (no vector blur).
 *   3. Loops `targetPose` on the shared mascot clock.
 *
 * Under `prefers-reduced-motion: reduce`, renders `targetPose` frozen at frame 0 immediately.
 */
export function PeanutBuddyMascot({ targetPose, onLanded, alt }: PeanutBuddyMascotProps) {
    const walkContainerRef = useRef<HTMLDivElement>(null)
    const targetContainerRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const onLandedRef = useRef(onLanded)
    onLandedRef.current = onLanded

    const [phase, setPhase] = useState<BuddyMotionPhase>('loading')
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        setPrefersReducedMotion(query.matches)
        const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    useEffect(() => {
        const walkHost = walkContainerRef.current
        const targetHost = targetContainerRef.current
        if (!walkHost || !targetHost) return

        let cancelled = false
        let walkAnim: AnimationItem | null = null
        let targetAnim: AnimationItem | null = null
        let stopClock: (() => void) | null = null
        let rafId: number | null = null
        let activePairs: RigLayerPair[] = []

        void Promise.all([
            import('lottie-web/build/player/lottie_light'),
            MASCOT_ANIMATION_LOADERS.walking(),
            MASCOT_ANIMATION_LOADERS[targetPose](),
        ])
            .then(([lottie, walkData, targetData]) => {
                if (cancelled) return

                walkAnim = lottie.default.loadAnimation({
                    container: walkHost,
                    renderer: 'svg',
                    loop: true,
                    autoplay: false,
                    animationData: walkData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })

                targetAnim = lottie.default.loadAnimation({
                    container: targetHost,
                    renderer: 'svg',
                    loop: true,
                    autoplay: false,
                    animationData: targetData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })

                walkAnim.goToAndStop(0, true)
                targetAnim.goToAndStop(0, true)

                if (prefersReducedMotion) {
                    walkHost.style.opacity = '0'
                    targetHost.style.opacity = '1'
                    setPhase('idle')
                    onLandedRef.current?.()
                    return
                }

                // Phase 1: Stuttered walk-in
                walkHost.style.opacity = '1'
                targetHost.style.opacity = '0'
                setPhase('walking')

                let virtualFrame = 0
                let shownFrame = -1
                const walkStartedAt = performance.now()
                let morphStarted = false

                const startIdleLoop = () => {
                    if (cancelled || !targetAnim) return
                    const total = targetAnim.totalFrames || 1
                    const fps = targetAnim.frameRate || 30
                    let idleFrame = 0
                    let idleShown = -1
                    setPhase('idle')
                    onLandedRef.current?.()

                    stopClock = subscribeToMascotClock((deltaSeconds) => {
                        if (!targetAnim) return
                        idleFrame = (idleFrame + deltaSeconds * fps * MASCOT_SPEED) % total
                        const held = Math.floor(idleFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
                        if (held === idleShown) return
                        idleShown = held
                        targetAnim.goToAndStop(jitterFrame(held, total), true)
                    })
                }

                const startRigMorph = () => {
                    if (cancelled || !walkAnim || !targetAnim) return
                    setPhase('morphing')
                    targetAnim.goToAndStop(0, true)
                    activePairs = collectSharedRigPairs(
                        walkAnim as unknown as Parameters<typeof collectSharedRigPairs>[0],
                        targetAnim as unknown as Parameters<typeof collectSharedRigPairs>[1]
                    )

                    if (activePairs.length === 0) {
                        // Graceful fallback (e.g. jsdom tests without real SVG matrices)
                        walkHost.style.opacity = '0'
                        targetHost.style.opacity = '1'
                        startIdleLoop()
                        return
                    }

                    const morphT0 = performance.now()
                    const tickMorph = (now: number) => {
                        if (cancelled) return
                        const progress = Math.min(1, (now - morphT0) / MORPH_DURATION_MS)
                        const { showTargetArt } = applyRigMorphStep(activePairs, progress)
                        walkHost.style.opacity = showTargetArt ? '0' : '1'
                        targetHost.style.opacity = showTargetArt ? '1' : '0'

                        if (stageRef.current) {
                            const { scaleX, scaleY, translateY } = computeFootPlantSquash(progress)
                            stageRef.current.style.transform = `translateY(${translateY.toFixed(2)}px) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`
                        }

                        if (progress < 1) {
                            rafId = requestAnimationFrame(tickMorph)
                            return
                        }

                        if (stageRef.current) stageRef.current.style.transform = ''
                        restoreRigTransforms(activePairs)
                        activePairs = []
                        walkHost.style.opacity = '0'
                        targetHost.style.opacity = '1'
                        startIdleLoop()
                    }
                    rafId = requestAnimationFrame(tickMorph)
                }

                const walkTotal = walkAnim.totalFrames || 1
                const walkFps = walkAnim.frameRate || 30
                stopClock = subscribeToMascotClock((deltaSeconds) => {
                    if (!walkAnim) return
                    if (!morphStarted && performance.now() - walkStartedAt >= WALK_DURATION_MS) {
                        morphStarted = true
                        stopClock?.()
                        stopClock = null
                        startRigMorph()
                        return
                    }
                    virtualFrame = (virtualFrame + deltaSeconds * walkFps * MASCOT_SPEED) % walkTotal
                    const held = Math.floor(virtualFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
                    if (held === shownFrame) return
                    shownFrame = held
                    walkAnim.goToAndStop(jitterFrame(held, walkTotal), true)
                })
            })
            // Decorative mascot must never trigger global ChunkLoadError page reloads.
            .catch(() => {})

        return () => {
            cancelled = true
            stopClock?.()
            if (rafId !== null) cancelAnimationFrame(rafId)
            if (activePairs.length > 0) restoreRigTransforms(activePairs)
            walkAnim?.destroy()
            targetAnim?.destroy()
        }
    }, [targetPose, prefersReducedMotion])

    return (
        <div
            ref={stageRef}
            className="relative size-full origin-bottom"
            role={alt ? 'img' : undefined}
            aria-label={alt || undefined}
            aria-hidden={alt ? undefined : true}
            data-testid="peanut-buddy-mascot"
            data-buddy-phase={phase}
            data-buddy-pose={targetPose}
        >
            <div ref={walkContainerRef} className="pointer-events-none absolute inset-0" />
            <div ref={targetContainerRef} className="pointer-events-none absolute inset-0 opacity-0" />
        </div>
    )
}
