'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'

const loaders = {
    card: () => import('@/assets/onboarding/card.json'),
    bank: () => import('@/assets/onboarding/bank.json'),
    fees: () => import('@/assets/onboarding/fees.json'),
    security: () => import('@/assets/onboarding/security.json'),
    documents: () => import('@/assets/onboarding/documents.json'),
    email: () => import('@/assets/onboarding/email.json'),
    notifications: () => import('@/assets/onboarding/notifications.json'),
}
export type OnboardingAnimationName = keyof typeof loaders

/** Onboarding lab vectors plus the matching documents and email illustrations. */
export default function OnboardingAnimation({ name }: { name: OnboardingAnimationName }) {
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
            className="aspect-square h-full w-auto max-w-none scale-[1.4] md:scale-[1.2]"
        />
    )
}
