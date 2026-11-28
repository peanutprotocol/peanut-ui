'use client'

import { useReducedMotion } from 'framer-motion'
import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import {
    MASCOT_ANIMATION_LOADERS,
    MASCOT_HOLD_FRAMES,
    MASCOT_SPEED,
} from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { jitterFrame, subscribeToMascotClock } from '@/components/Global/PeanutMascot/PeanutMascot.utils'
import {
    computePoseTransitionFrame,
    formatPoseTransitionTransform,
    POSE_TRANSITION_PROFILES,
    shouldExitWalkToTransition,
} from '../rigMorph'
import type { StuckBuddyPose } from '../types'

const MIN_WALK_DURATION_MS = 680

export type BuddyMotionPhase = 'loading' | 'walking' | 'transitioning' | 'idle'

interface PeanutBuddyMascotProps {
    targetPose: StuckBuddyPose
    /** Fired right on touchdown so the speech bubble springs open with Peanut's landing impact. */
    onLanded?: () => void
    /** Fired if the Lottie chunk fails to load so the parent can fall back cleanly. */
    onLoadFailed?: () => void
    /** When true (whimsy cameo auto-leave), Peanut turns around and walks cheerfully back off-screen. */
    exiting?: boolean
}

/**
 * Dual-rig Lottie mascot player for the walking Peanut buddy:
 *   1. Plays `walking` with Peanut's vintage stutter (`hold=2`, `1.30x`) while sliding in,
 *      locking onto a pose-matched foot-contact exit frame (never freezing mid-stride).
 *   2. Executes a 4-beat Disney character transition anchored at his feet:
 *      braking anticipation squat -> elastic stretch hop -> 1-frame apex pose cut with
 *      overlapping target playback -> weighted touchdown squash & damped settle.
 *   3. Loops `targetPose` seamlessly on the shared mascot clock (or mirrors `walking` on exit).
 *
 * Under `prefers-reduced-motion: reduce`, renders `targetPose` frozen at frame 0 immediately.
 */
export function PeanutBuddyMascot({ targetPose, onLanded, onLoadFailed, exiting = false }: PeanutBuddyMascotProps) {
    const walkContainerRef = useRef<HTMLDivElement>(null)
    const targetContainerRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const onLandedRef = useRef(onLanded)
    onLandedRef.current = onLanded
    const onLoadFailedRef = useRef(onLoadFailed)
    onLoadFailedRef.current = onLoadFailed
    const exitingRef = useRef(exiting)
    exitingRef.current = exiting

    const reducedMotion = Boolean(useReducedMotion())
    const [phase, setPhase] = useState<BuddyMotionPhase>('loading')

    useEffect(() => {
        const walkHost = walkContainerRef.current
        const targetHost = targetContainerRef.current
        const stageEl = stageRef.current
        if (!walkHost || !targetHost) return

        let cancelled = false
        let walkAnim: AnimationItem | null = null
        let targetAnim: AnimationItem | null = null
        let stopClock: (() => void) | null = null
        let rafId: number | null = null

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

                if (reducedMotion) {
                    walkHost.style.opacity = '0'
                    targetHost.style.opacity = '1'
                    setPhase('idle')
                    onLandedRef.current?.()
                    return
                }

                const profile = POSE_TRANSITION_PROFILES[targetPose]

                walkHost.style.opacity = '1'
                targetHost.style.opacity = '0'
                setPhase('walking')

                let virtualFrame = 0
                let shownFrame = -1
                const walkStartedAt = performance.now()
                let transitionStarted = false

                const startIdleLoop = (initialFrame: number, initialShown: number) => {
                    if (cancelled || !targetAnim) return
                    const total = targetAnim.totalFrames || 1
                    const fps = targetAnim.frameRate || 30
                    let idleFrame = initialFrame
                    let idleShown = initialShown
                    let exitWalkFrame = 0
                    let exitWalkShown = -1
                    const exitWalkTotal = walkAnim?.totalFrames || 1
                    const exitWalkFps = walkAnim?.frameRate || 30
                    setPhase('idle')

                    stopClock = subscribeToMascotClock((deltaSeconds) => {
                        if (exitingRef.current && walkAnim) {
                            walkHost.style.opacity = '1'
                            targetHost.style.opacity = '0'
                            if (stageEl) stageEl.style.transform = 'scaleX(-1)'
                            exitWalkFrame = (exitWalkFrame + deltaSeconds * exitWalkFps * MASCOT_SPEED) % exitWalkTotal
                            const held = Math.floor(exitWalkFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
                            if (held === exitWalkShown) return
                            exitWalkShown = held
                            walkAnim.goToAndStop(jitterFrame(held, exitWalkTotal), true)
                            return
                        }
                        if (!targetAnim) return
                        idleFrame = (idleFrame + deltaSeconds * fps * MASCOT_SPEED) % total
                        const held = Math.floor(idleFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
                        if (held === idleShown) return
                        idleShown = held
                        targetAnim.goToAndStop(jitterFrame(held, total), true)
                    })
                }

                const startPoseTransition = () => {
                    if (cancelled || !walkAnim || !targetAnim) return
                    setPhase('transitioning')
                    walkAnim.goToAndStop(profile.walkExitFrame, true)
                    targetAnim.goToAndStop(0, true)

                    const total = targetAnim.totalFrames || 1
                    const fps = targetAnim.frameRate || 30
                    const transitionT0 = performance.now()
                    let lastNow = transitionT0
                    let targetFrame = 0
                    let targetShown = 0
                    let bubbleFired = false

                    const tickTransition = (now: number) => {
                        if (cancelled || !targetAnim) return
                        const dt = Math.min((now - lastNow) / 1000, 0.1)
                        lastNow = now

                        const progress = Math.min(1, (now - transitionT0) / profile.durationMs)
                        const frame = computePoseTransitionFrame(targetPose, progress)

                        walkHost.style.opacity = frame.showTargetArt ? '0' : '1'
                        targetHost.style.opacity = frame.showTargetArt ? '1' : '0'

                        if (frame.showTargetArt) {
                            targetFrame = (targetFrame + dt * fps * MASCOT_SPEED) % total
                            const held = Math.floor(targetFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES
                            if (held !== targetShown) {
                                targetShown = held
                                targetAnim.goToAndStop(jitterFrame(held, total), true)
                            }
                        }

                        if (frame.bubbleReady && !bubbleFired) {
                            bubbleFired = true
                            onLandedRef.current?.()
                        }

                        if (stageRef.current) {
                            stageRef.current.style.transform = formatPoseTransitionTransform(frame)
                        }

                        if (progress < 1) {
                            rafId = requestAnimationFrame(tickTransition)
                            return
                        }

                        if (stageRef.current) stageRef.current.style.transform = ''
                        walkHost.style.opacity = '0'
                        targetHost.style.opacity = '1'
                        if (!bubbleFired) {
                            bubbleFired = true
                            onLandedRef.current?.()
                        }
                        startIdleLoop(targetFrame, targetShown)
                    }

                    rafId = requestAnimationFrame(tickTransition)
                }

                const walkTotal = walkAnim.totalFrames || 1
                const walkFps = walkAnim.frameRate || 30
                stopClock = subscribeToMascotClock((deltaSeconds) => {
                    if (!walkAnim) return
                    const elapsed = performance.now() - walkStartedAt
                    virtualFrame = (virtualFrame + deltaSeconds * walkFps * MASCOT_SPEED) % walkTotal
                    const held = Math.floor(virtualFrame / MASCOT_HOLD_FRAMES) * MASCOT_HOLD_FRAMES

                    if (
                        !transitionStarted &&
                        shouldExitWalkToTransition(held, profile.walkExitFrame, elapsed, MIN_WALK_DURATION_MS)
                    ) {
                        transitionStarted = true
                        stopClock?.()
                        stopClock = null
                        startPoseTransition()
                        return
                    }

                    if (held === shownFrame) return
                    shownFrame = held
                    walkAnim.goToAndStop(jitterFrame(held, walkTotal), true)
                })
            })
            .catch(() => {
                if (!cancelled) onLoadFailedRef.current?.()
            })

        return () => {
            cancelled = true
            stopClock?.()
            if (rafId !== null) cancelAnimationFrame(rafId)
            if (stageEl) stageEl.style.transform = ''
            walkAnim?.destroy()
            targetAnim?.destroy()
        }
    }, [targetPose, reducedMotion])

    return (
        <div
            ref={stageRef}
            className="relative size-full origin-[50%_90%] will-change-transform"
            aria-hidden="true"
            data-testid="peanut-buddy-mascot"
            data-buddy-phase={phase}
            data-buddy-pose={targetPose}
        >
            <div ref={walkContainerRef} className="pointer-events-none absolute inset-0" />
            <div ref={targetContainerRef} className="pointer-events-none absolute inset-0 opacity-0" />
        </div>
    )
}
