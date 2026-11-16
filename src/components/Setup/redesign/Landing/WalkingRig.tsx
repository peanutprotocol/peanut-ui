'use client'

import type { AnimationItem } from 'lottie-web'
import { useEffect, useRef, useState } from 'react'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'

/**
 * The approved walking rig, held on the frame it is given. PeanutMascot runs its own loop; the X1 walk needs every
 * shown frame in step with the coin row, so this player has no loop of its own (contract P1 § 9 C4).
 */
export function WalkingRig({ frame }: { frame: number }) {
    const hostRef = useRef<HTMLDivElement>(null)
    const [animation, setAnimation] = useState<AnimationItem | null>(null)

    useEffect(() => {
        const container = hostRef.current
        if (!container) return
        let cancelled = false
        let instance: AnimationItem | null = null
        void Promise.all([import('lottie-web/build/player/lottie_light'), MASCOT_ANIMATION_LOADERS.walking()])
            .then(([lottie, animationData]) => {
                if (cancelled) return
                instance = lottie.default.loadAnimation({
                    container,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: animationData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                setAnimation(instance)
            })
            // a decorative walker is not worth a chunk-error reload (PeanutMascot does the same): the box stays empty
            .catch(() => {})
        return () => {
            cancelled = true
            instance?.destroy()
            setAnimation(null)
        }
    }, [])

    useEffect(() => {
        animation?.goToAndStop(frame, true)
    }, [animation, frame])

    return <div ref={hostRef} className="absolute inset-0" data-lottie-ready={animation ? 'true' : 'false'} />
}
