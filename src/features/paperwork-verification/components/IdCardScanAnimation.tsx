'use client'

import { useEffect, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'
import { MASCOT_SPEED } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { twMerge } from '@/utils/tw'

// The frame where the card is drawn, scanned and checked: the still for reduced motion.
const STILL_FRAME = 50

/** The document screen's hero: an ID card being scanned, drawn to the mascot's line rules. */
export function IdCardScanAnimation({ className }: { className?: string }) {
    const stageRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const container = stageRef.current
        if (!container) return
        let cancelled = false
        let instance: AnimationItem | null = null
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
        void Promise.all([import('lottie-web/build/player/lottie_light'), import('@/assets/kyc/id-card-scan.json')])
            .then(([lottie, animationData]) => {
                if (cancelled) return
                instance = lottie.default.loadAnimation({
                    container,
                    renderer: 'svg',
                    loop: true,
                    autoplay: !reduced,
                    animationData: animationData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                instance.setSpeed(MASCOT_SPEED)
                if (reduced) instance.goToAndStop(STILL_FRAME, true)
            })
            // Decorative: a failed chunk leaves the box empty instead of reaching the global reload handler.
            .catch(() => {})
        return () => {
            cancelled = true
            instance?.destroy()
        }
    }, [])
    return <div ref={stageRef} aria-hidden className={twMerge('pointer-events-none', className)} />
}
