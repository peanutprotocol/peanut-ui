'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import { MASCOT_HOLD_FRAMES, MASCOT_SPEED } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { subscribeToMascotClock } from '@/components/Global/PeanutMascot/PeanutMascot.utils'

const loaders = {
    local: () => import('@/assets/onboarding/local.json'),
    exchange: () => import('@/assets/illustrations/lottie/coin-swap.json'),
    people: () => import('@/assets/illustrations/lottie/plane-delivery.json'),
    username: () => import('@/assets/onboarding/username-at.json'),
    card: () => import('@/assets/illustrations/lottie/card-flip.json'),
    bank: () => import('@/assets/illustrations/lottie/globe-world-route.json'),
    fees: () => import('@/assets/illustrations/lottie/receipt.json'),
    security: () => import('@/assets/onboarding/security.json'),
    documents: () => import('@/assets/onboarding/documents.json'),
    email: () => import('@/assets/illustrations/lottie/envelope-verify.json'),
    notifications: () => import('@/assets/onboarding/notifications.json'),
    'phone-to-phone': () => import('@/assets/illustrations/lottie/phone-to-phone.json'),
    topup: () => import('@/assets/illustrations/lottie/wallet-topup.json'),
}
export type OnboardingAnimationName = keyof typeof loaders
// Checklist, feature and email illustrations use 80% of their previous scale.
const COMPACT_ANIMATIONS = new Set<OnboardingAnimationName>([
    'phone-to-phone',
    'bank',
    'exchange',
    'local',
    'people',
    'topup',
    'email',
])
const REDUCED_MOTION_FRAMES: Partial<Record<OnboardingAnimationName, number>> = {
    people: 30,
    email: 40,
    fees: 32,
    exchange: 0,
    'phone-to-phone': 36,
    topup: 32,
}
/** How fast each comp's timeline runs; the on-screen update rhythm is the mascot's for all of them. */
export const ONBOARDING_TEMPO: Partial<Record<OnboardingAnimationName, number>> = {
    username: 4,
    fees: 0.5,
    email: 0.5,
    exchange: 0.5,
}
export const CARD_RESTART_DELAY_MS = 1000

/** Onboarding lab vectors plus the matching documents and email illustrations. */
export default function OnboardingAnimation({
    name,
    background = false,
}: {
    name: OnboardingAnimationName
    background?: boolean
}) {
    const container = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)
    useEffect(() => {
        let cancelled = false
        let animation: AnimationItem | undefined
        let stopClock: (() => void) | undefined
        let restartTimer: ReturnType<typeof setTimeout> | undefined
        let waitingForRestart = false
        let virtualFrame = 0
        let sinceStep = 0
        const loop = name !== 'card'
        const tempo = ONBOARDING_TEMPO[name] ?? 1
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const halt = () => {
            stopClock?.()
            stopClock = undefined
            if (restartTimer !== undefined) clearTimeout(restartTimer)
            restartTimer = undefined
        }
        // Same stepped rhythm as PeanutMascot: a new pose every MASCOT_HOLD_FRAMES mascot
        // frames, so objects and mascot stutter together. The tempo only changes how far
        // each step travels along this comp's timeline.
        const tick = (deltaSeconds: number) => {
            if (!animation) return
            const stepSeconds = MASCOT_HOLD_FRAMES / (animation.frameRate * MASCOT_SPEED)
            sinceStep += deltaSeconds
            if (sinceStep < stepSeconds) return
            const steps = Math.floor(sinceStep / stepSeconds)
            sinceStep -= steps * stepSeconds
            virtualFrame += steps * stepSeconds * animation.frameRate * tempo
            const lastFrame = animation.totalFrames - 1
            if (virtualFrame >= lastFrame && !loop) {
                animation.goToAndStop(lastFrame, true)
                halt()
                waitingForRestart = true
                sync()
                return
            }
            virtualFrame %= animation.totalFrames
            animation.goToAndStop(virtualFrame, true)
        }
        const sync = () => {
            if (!animation) return
            // Show the completed objects instead of blank paper or a closed envelope.
            if (reducedMotion.matches) {
                halt()
                waitingForRestart = false
                virtualFrame = 0
                animation.goToAndStop(REDUCED_MOTION_FRAMES[name] ?? 0, true)
            } else if (document.hidden) halt()
            else if (waitingForRestart) {
                if (restartTimer !== undefined) return
                restartTimer = setTimeout(() => {
                    restartTimer = undefined
                    if (cancelled || !animation) return
                    waitingForRestart = false
                    virtualFrame = 0
                    animation.goToAndStop(0, true)
                    sync()
                }, CARD_RESTART_DELAY_MS)
            } else if (!stopClock) {
                sinceStep = 0
                stopClock = subscribeToMascotClock(tick)
            }
        }
        void Promise.all([import('lottie-web/build/player/lottie_light'), loaders[name]()])
            .then(([lottie, data]) => {
                if (cancelled || !container.current) return
                animation = lottie.default.loadAnimation({
                    container: container.current,
                    renderer: 'svg',
                    loop,
                    autoplay: false,
                    animationData: data.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                animation.addEventListener('DOMLoaded', () => {
                    setReady(true)
                    sync()
                })
                sync()
            })
            .catch(() => {})
        reducedMotion.addEventListener('change', sync)
        document.addEventListener('visibilitychange', sync)
        return () => {
            cancelled = true
            halt()
            reducedMotion.removeEventListener('change', sync)
            document.removeEventListener('visibilitychange', sync)
            animation?.destroy()
        }
    }, [name])
    return (
        <div
            ref={container}
            aria-hidden="true"
            data-onboarding-animation={name}
            data-lottie-ready={ready}
            className={
                background
                    ? 'h-full w-full'
                    : name === 'fees'
                      ? 'aspect-square h-full w-auto max-w-none scale-[1.2] md:scale-[1.028]'
                      : name === 'card'
                        ? 'aspect-square h-full w-auto max-w-none scale-[1.344] md:scale-[1.152]'
                        : COMPACT_ANIMATIONS.has(name)
                          ? 'aspect-square h-full w-auto max-w-none scale-[1.12] md:scale-[0.96]'
                          : name === 'security'
                            ? 'aspect-square h-full w-auto max-w-none scale-[1.68] md:scale-[1.44]'
                            : name === 'notifications'
                              ? 'aspect-square h-full w-auto max-w-none scale-[1.54] md:scale-[1.32]'
                              : 'aspect-square h-full w-auto max-w-none scale-[1.4] md:scale-[1.2]'
            }
        />
    )
}
