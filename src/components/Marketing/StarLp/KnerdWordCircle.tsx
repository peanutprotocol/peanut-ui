import ScribbleCircle from '@/assets/illustrations/scribble-circle.svg'
import { PopIn } from './PopIn'

/**
 * The homepage's hand-drawn scribble circle, as a Title mark: Title wraps the
 * word and places this inside the word's box, painted under every letter
 * layer (and the knockout in the ground's colour) while the stroke crosses
 * their tops and feet, as in the picked mockup.
 */
export function KnerdWordCircle() {
    return (
        <PopIn
            as="span"
            delay={0.3}
            tilt={-4}
            className="pointer-events-none absolute -top-[0.2em] right-[calc(-9%-0.03em)] -bottom-[0.08em] left-[calc(-9%+0.03em)] -z-10 block select-none"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={ScribbleCircle.src}
                width={ScribbleCircle.width}
                height={ScribbleCircle.height}
                alt=""
                aria-hidden
                className="block h-full w-full max-w-none"
            />
        </PopIn>
    )
}
