import { Star } from '@/assets'
import { AnimateOnView } from '@/components/Global/AnimateOnView'

interface StarPlacement {
    className: string
    width: number
    height: number
    delay: string
    x: string
    rotate: string
}

/**
 * Pre-defined star placement sets. Each h2 cycles through these
 * via a module-level counter so stars appear in varied positions.
 */
const placements: StarPlacement[][] = [
    [
        {
            className: 'absolute -right-4 -top-2 md:right-8',
            width: 40,
            height: 40,
            delay: '0.15s',
            x: '5px',
            rotate: '22deg',
        },
    ],
    [
        {
            className: 'absolute -left-4 top-0 md:left-8',
            width: 35,
            height: 35,
            delay: '0.25s',
            x: '-5px',
            rotate: '-15deg',
        },
    ],
    [
        {
            className: 'absolute -right-2 -top-4 md:right-16',
            width: 32,
            height: 32,
            delay: '0.1s',
            x: '3px',
            rotate: '45deg',
        },
        {
            className: 'absolute -left-6 top-4 md:left-4 hidden md:block',
            width: 28,
            height: 28,
            delay: '0.5s',
            x: '-4px',
            rotate: '-10deg',
        },
    ],
    [
        {
            className: 'absolute -left-2 -top-2 md:left-12',
            width: 38,
            height: 38,
            delay: '0.2s',
            x: '-3px',
            rotate: '12deg',
        },
    ],
]

let counter = 0

/** Decorative stars placed in the margins around prose h2 headings. */
export function ProseStars() {
    const set = placements[counter % placements.length]
    counter++

    return (
        <>
            {set.map((star, i) => (
                <AnimateOnView key={i} className={star.className} delay={star.delay} x={star.x} rotate={star.rotate}>
                    <img src={Star.src} alt="" width={star.width} height={star.height} />
                </AnimateOnView>
            ))}
        </>
    )
}
