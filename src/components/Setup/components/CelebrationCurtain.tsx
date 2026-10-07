'use client'

import { useEffect, useRef } from 'react'
import { isCapacitor } from '@/utils/capacitor'
import { startSetupCelebration } from '@/utils/setup-celebration'
import styles from './CelebrationCurtain.module.css'

/** One particle effect owns the fireworks and both sides of the curtain. */
export default function CelebrationCurtain() {
    const canvas = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        let cancelled = false
        let stop: (() => void) | undefined
        const motion = matchMedia('(prefers-reduced-motion: reduce)')
        const cancel = () => {
            if (cancelled) return
            cancelled = true
            stop?.()
        }
        const hide = () => {
            if (document.hidden) cancel()
        }
        void import('canvas-confetti')
            .then(({ default: confetti }) => {
                if (cancelled || !canvas.current || document.hidden) return
                const native = isCapacitor()
                const fire = confetti.create(canvas.current, { resize: true, useWorker: !native })
                stop = startSetupCelebration(fire, { native, reduced: motion.matches })
            })
            .catch(() => {})
        document.addEventListener('visibilitychange', hide)
        motion.addEventListener('change', cancel)
        return () => {
            cancel()
            document.removeEventListener('visibilitychange', hide)
            motion.removeEventListener('change', cancel)
        }
    }, [])
    return <canvas ref={canvas} className={styles.curtain} aria-hidden="true" data-celebration-curtain />
}
