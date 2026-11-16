import type { Variants } from 'framer-motion'

/*
 * The step transition (mock MOTION.md § 4, scaffold core/shell.js slide()). Next: the incoming stage slides in from
 * the right over the old one in 500 ms, carrying its ground, headline and art, with a 2 px black leading edge; the
 * old art is cut at that edge. Back reverses it: the old stage slides off to the right. Panel content slides 30 %
 * and crossfades. Reduced motion: a 200 ms crossfade, nothing moves.
 * Every variant takes the direction as `custom`: 1 forward, -1 back.
 */
export const STEP_S = 0.5
export const SEAM_S = 0.3
export const REDUCED_S = 0.2
export const STEP_EASE = [0.22, 1, 0.36, 1] as const
/** The hero's entrance starts this long after the stage starts to slide (mock --art-delay). */
export const ART_DELAY_S = 0.1
/** Delay between the pieces of one entrance (mock --stagger). */
export const ART_STAGGER_S = 0.06

const step = { duration: STEP_S, ease: STEP_EASE }
const fade = { duration: REDUCED_S, ease: 'linear' } as const

export function stageVariants(reduced: boolean): Variants {
    if (reduced)
        return {
            enter: { opacity: 0, zIndex: 2 },
            center: { opacity: 1, zIndex: 2, transition: fade },
            exit: { opacity: 1, zIndex: 1, transition: fade },
        }
    return {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '0%',
            zIndex: direction > 0 ? 2 : 1,
            boxShadow: direction > 0 ? '-2px 0 0 #000' : '0 0 0 #000',
        }),
        center: { x: '0%', transition: step, transitionEnd: { zIndex: 1, boxShadow: 'none' } },
        exit: (direction: number) => ({
            x: direction > 0 ? '0%' : '100%',
            zIndex: direction > 0 ? 1 : 2,
            boxShadow: direction > 0 ? 'none' : '2px 0 0 #000',
            transition: step,
        }),
    }
}

/** The art layer moves with its stage; the art under the moving stage is cut at the stage's leading edge. */
export function artVariants(reduced: boolean): Variants {
    if (reduced)
        return {
            enter: { opacity: 0, zIndex: 8 },
            center: { opacity: 1, zIndex: 8, transition: fade },
            exit: { opacity: 1, zIndex: 7, transition: fade },
        }
    return {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '0%',
            clipPath: direction > 0 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)',
            zIndex: direction > 0 ? 8 : 7,
        }),
        center: {
            x: '0%',
            clipPath: 'inset(0% 0% 0% 0%)',
            transition: step,
            transitionEnd: { zIndex: 8, clipPath: 'none' },
        },
        exit: (direction: number) => ({
            x: direction > 0 ? '0%' : '100%',
            clipPath: direction > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 0%)',
            zIndex: direction > 0 ? 7 : 8,
            transition: step,
        }),
    }
}

export function panelVariants(reduced: boolean): Variants {
    if (reduced)
        return {
            enter: { opacity: 0, zIndex: 5 },
            center: { opacity: 1, zIndex: 5, transition: fade },
            exit: { opacity: 0, zIndex: 4, transition: fade },
        }
    return {
        enter: (direction: number) => ({ opacity: 0, x: direction < 0 ? '-30%' : '30%', zIndex: 5 }),
        center: {
            opacity: 1,
            x: '0%',
            zIndex: 5,
            transition: { duration: STEP_S - 0.08, delay: 0.08, ease: STEP_EASE },
        },
        exit: (direction: number) => ({
            opacity: 0,
            x: direction < 0 ? '30%' : '-30%',
            zIndex: 4,
            transition: { duration: STEP_S * 0.6, ease: STEP_EASE },
        }),
    }
}

/** Art entrance recipes (mock MOTION.md § 3): played once, then the piece holds still. */
export type ArtEntrance = 'none' | 'pop' | 'stamp' | 'deal'

/** `delay` in seconds: the art delay plus the piece's place in the stagger. */
export function entranceVariants(entrance: ArtEntrance, rotate: number, delay: number): Variants {
    switch (entrance) {
        case 'pop':
            return {
                from: { opacity: 0, scale: 0.3, rotate: rotate + 12 },
                to: { opacity: 1, scale: 1, rotate, transition: { duration: 0.3, delay, ease: [0.34, 1.56, 0.64, 1] } },
            }
        case 'stamp':
            return {
                from: { opacity: 0, scale: 1.6, rotate },
                to: {
                    opacity: 1,
                    scale: [1.6, 1, 1.04, 1],
                    rotate,
                    transition: { duration: 0.32, delay, times: [0, 0.62, 0.81, 1], ease: [0.55, 0, 1, 0.45] },
                },
            }
        case 'deal':
            return {
                from: { opacity: 0, y: 60, rotate: rotate - 6 },
                to: { opacity: 1, y: 0, rotate, transition: { duration: 0.4, delay, ease: [0.34, 1.56, 0.64, 1] } },
            }
        default:
            return { from: { rotate }, to: { rotate } }
    }
}
