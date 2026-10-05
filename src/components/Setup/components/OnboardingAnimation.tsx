'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'

const loaders = {
    username: () => import('@/assets/onboarding/username-at.json'),
    card: () => import('@/assets/onboarding/card.json'),
    bank: () => import('@/assets/onboarding/bank.json'),
    fees: () => import('@/assets/illustrations/lottie/fee-scissors.json'),
    security: () => import('@/assets/onboarding/security.json'),
    documents: () => import('@/assets/illustrations/lottie/id-card.json'),
    email: () => import('@/assets/illustrations/lottie/envelope-verify.json'),
    notifications: () => import('@/assets/onboarding/notifications.json'),
}
export type OnboardingAnimationName = keyof typeof loaders

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
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const play = () => {
            if (!animation) return
            if (reducedMotion.matches) animation.goToAndStop(0, true)
            else if (document.hidden) animation.pause()
            else animation.play()
        }
        void Promise.all([import('lottie-web/build/player/lottie_light'), loaders[name]()])
            .then(([lottie, data]) => {
                if (cancelled || !container.current) return
                animation = lottie.default.loadAnimation({
                    container: container.current,
                    renderer: 'svg',
                    loop: true,
                    autoplay: false,
                    animationData: data.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                if (name === 'fees' || name === 'email') animation.setSpeed(0.5)
                animation.addEventListener('DOMLoaded', () => {
                    setReady(true)
                    play()
                })
                play()
            })
            .catch(() => {})
        reducedMotion.addEventListener('change', play)
        document.addEventListener('visibilitychange', play)
        return () => {
            cancelled = true
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
            className={
                background ? 'h-full w-full' : 'aspect-square h-full w-auto max-w-none scale-[1.4] md:scale-[1.2]'
            }
        />
    )
}
