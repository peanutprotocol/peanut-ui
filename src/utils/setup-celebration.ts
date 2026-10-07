import type { CreateTypes, Options } from 'canvas-confetti'
import { STAR_CONFETTI_COLORS } from './confetti'

/** Finish emitting together, then let every region settle before the 4.5s redirect. */
export function startSetupCelebration(fire: CreateTypes, { native, reduced }: { native: boolean; reduced: boolean }) {
    const base: Options = {
        shapes: ['star'],
        colors: STAR_CONFETTI_COLORS,
        scalar: 1.4,
        startVelocity: 5,
        gravity: 0.25,
        decay: 0.96,
        ticks: 72,
    }
    let wave = 0
    const emit = () => {
        void fire({
            ...base,
            origin: { x: 0.5, y: 0.05 },
            particleCount: wave ? (native ? 4 : 8) : native ? 24 : 40,
            angle: 270,
            spread: 140,
        })
        const heights = wave ? [0.08 + (wave % 8) * 0.12] : Array.from({ length: 8 }, (_, index) => 0.08 + index * 0.12)
        for (const y of heights) {
            void fire({ ...base, origin: { x: 0, y }, particleCount: native ? 1 : 2, angle: 0, spread: 40 })
            void fire({ ...base, origin: { x: 1, y }, particleCount: native ? 1 : 2, angle: 180, spread: 40 })
        }
        wave++
    }
    if (reduced) {
        void fire({ ...base, origin: { x: 0.5, y: 0.08 }, particleCount: 10, startVelocity: 6, ticks: 40, spread: 100 })
    } else emit()
    const interval = reduced ? undefined : setInterval(emit, 240)
    const finishEmitting = setTimeout(() => clearInterval(interval), 2800)
    const settle = setTimeout(() => fire.reset(), 4200)
    return () => {
        clearInterval(interval)
        clearTimeout(finishEmitting)
        clearTimeout(settle)
        fire.reset()
    }
}
