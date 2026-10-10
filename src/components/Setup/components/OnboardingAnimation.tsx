'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import { LOOP_HOLD_MS, planLoop, stillFrame, type LoopMarker } from './loopPlayback.utils'

/*
 * The sign-up hero loops. Each file is one screen's loop; replacing a file swaps that
 * screen's art with no code change. Sources and revisions: src/assets/onboarding/README.md.
 */
const loaders = {
    invite: () => import('@/assets/onboarding/invite.json'),
    residence: () => import('@/assets/onboarding/residence.json'),
    'add-money': () => import('@/assets/onboarding/add-money.json'),
    accounts: () => import('@/assets/onboarding/accounts.json'),
    card: () => import('@/assets/onboarding/card.json'),
    email: () => import('@/assets/onboarding/email.json'),
    notifications: () => import('@/assets/onboarding/notifications.json'),
    finish: () => import('@/assets/onboarding/finish.json'),
    username: () => import('@/assets/onboarding/username-at.json'),
}
export type OnboardingAnimationName = keyof typeof loaders

/**
 * Plays a sign-up loop by its markers (see planLoop): the beat once, the held pose
 * for a few seconds, then the beat again. Under prefers-reduced-motion it shows the
 * held pose. The comp is not clipped to its box, so a loop can draw across the whole
 * hero; the hero's own edge clips it.
 */
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
        let holdTimer: ReturnType<typeof setTimeout> | undefined
        let phase: 'intro' | 'idle' | 'idle-once' | 'outro' = 'intro'
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const clearHold = () => {
            if (holdTimer !== undefined) clearTimeout(holdTimer)
            holdTimer = undefined
        }
        const comp = (data: unknown) => data as { markers?: LoopMarker[]; pp?: { idle_once?: boolean } }
        let plan = planLoop(undefined, 0)

        const playIntro = () => {
            if (!animation || plan.kind !== 'beat') return
            phase = 'intro'
            animation.loop = false
            animation.playSegments(plan.intro, true)
        }
        const playOutro = () => {
            if (!animation || plan.kind !== 'beat') return
            if (!plan.outro) return playIntro()
            phase = 'outro'
            animation.loop = false
            animation.playSegments(plan.outro, true)
        }
        const playIdle = () => {
            if (!animation || plan.kind !== 'beat') return
            clearHold()
            if (plan.idleOnce) {
                phase = 'idle-once'
                animation.loop = false
                animation.playSegments(plan.idle, true)
                return
            }
            phase = 'idle'
            animation.loop = true
            animation.playSegments(plan.idle, true)
            holdTimer = setTimeout(() => {
                holdTimer = undefined
                if (!cancelled) playOutro()
            }, LOOP_HOLD_MS)
        }
        const play = () => {
            if (!animation) return
            clearHold()
            if (reducedMotion.matches) {
                animation.goToAndStop(stillFrame(plan), true)
                return
            }
            if (document.hidden) {
                animation.pause()
                return
            }
            if (plan.kind === 'whole') {
                animation.loop = true
                animation.play()
            } else if (plan.kind === 'idle') {
                animation.loop = true
                animation.playSegments(plan.idle, true)
            } else playIntro()
        }

        void Promise.all([import('lottie-web/build/player/lottie_light'), loaders[name]()])
            .then(([lottie, data]) => {
                if (cancelled || !container.current) return
                animation = lottie.default.loadAnimation({
                    container: container.current,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: data.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                plan = planLoop(comp(data.default).markers, animation.totalFrames, !!comp(data.default).pp?.idle_once)
                animation.addEventListener('complete', () => {
                    if (phase === 'intro') playIdle()
                    else if (phase === 'idle-once') playOutro()
                    else if (phase === 'outro') playIntro()
                })
                animation.addEventListener('DOMLoaded', () => {
                    const svg = container.current?.querySelector('svg')
                    if (svg) {
                        svg.style.overflow = 'visible'
                        for (const group of Array.from(svg.children)) {
                            if (group.tagName.toLowerCase() === 'g') group.removeAttribute('clip-path')
                        }
                    }
                    setReady(true)
                    play()
                })
            })
            // A failed chunk must not escape: the app reloads on an unhandled
            // ChunkLoadError, and a decorative loop is not worth a reload.
            .catch(() => {})
        reducedMotion.addEventListener('change', play)
        document.addEventListener('visibilitychange', play)
        return () => {
            cancelled = true
            clearHold()
            reducedMotion.removeEventListener('change', play)
            document.removeEventListener('visibilitychange', play)
            animation?.destroy()
        }
    }, [name])
    return (
        <div
            ref={container}
            aria-hidden="true"
            data-onboarding-animation={name}
            data-lottie-ready={ready}
            className={background ? 'h-full w-full' : 'aspect-[1050/1000] h-full w-auto max-w-none'}
        />
    )
}
