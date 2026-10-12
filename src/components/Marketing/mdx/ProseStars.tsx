import Star from '@/assets/illustrations/star.svg'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import Image from 'next/image'

interface StarPlacement {
    className: string
    width: number
    height: number
    delay: string
    x: string
    rotate: string
}

/**
 * Pre-defined star placement sets. Each h2 picks one from its own heading
 * text, so stars vary between headings and stay the same on every render.
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

// a module-level counter used to do this, but it survives between requests:
// a heading's placement then depended on how many headings other pages had
// already rendered in the same server process.
function pickSet(seed: string): StarPlacement[] {
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
    return placements[Math.abs(hash) % placements.length]
}

/** Decorative stars placed in the margins around prose h2 headings. */
export function ProseStars({ seed = '' }: { seed?: string }) {
    const set = pickSet(seed)

    return (
        <>
            {set.map((star, i) => (
                <AnimateOnView key={i} className={star.className} delay={star.delay} x={star.x} rotate={star.rotate}>
                    <Image src={Star} alt="" width={star.width} height={star.height} />
                </AnimateOnView>
            ))}
        </>
    )
}
