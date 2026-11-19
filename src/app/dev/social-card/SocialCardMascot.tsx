'use client'

import { useEffect, useRef, useState } from 'react'
import { MASCOT_ANIMATION_LOADERS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'

/**
 * One held frame of the walking loop. PeanutMascot always plays (and jitters
 * its frames), so a capture of it is not repeatable; this holds the frame the
 * card names. `data-lottie-ready` tells the render script when to shoot.
 */
export function SocialCardMascot({ frame }: { frame: number }) {
    const stageRef = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const container = stageRef.current
        if (!container) return
        let cancelled = false
        let destroy = () => {}

        void Promise.all([import('lottie-web/build/player/lottie_light'), MASCOT_ANIMATION_LOADERS.walking()]).then(
            ([lottie, animationData]) => {
                if (cancelled) return
                const animation = lottie.default.loadAnimation({
                    container,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: animationData.default,
                    rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
                })
                animation.goToAndStop(frame, true)
                destroy = () => animation.destroy()
                setReady(true)
            }
        )

        return () => {
            cancelled = true
            destroy()
            setReady(false)
        }
    }, [frame])

    return <div ref={stageRef} className="size-full" data-lottie-ready={ready ? 'true' : 'false'} />
}
