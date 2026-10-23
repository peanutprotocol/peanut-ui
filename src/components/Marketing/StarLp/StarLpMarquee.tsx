import { Marquee } from '@/components/LandingPage/marquee'
import { twMerge } from '@/utils/tw'
import { BAND_GROUND_CLASS } from './starLp.consts'
import { marqueeStripGround } from './starLpMarquee.utils'
import type { StarLpMarqueeProps } from './starLp.types'

/**
 * The peanut.me landing marquee, placed on every seam where a pink, sky or
 * yellow fold meets another fold (the footer counts as black). Put it between
 * the two folds as a sibling; on the last seam it is the page's last child.
 * react-fast-marquee renders nothing until it mounts, so the wrapper paints the
 * strip (colour, 2px rules, the row's measured 60px) on the server and nothing
 * moves when the words arrive.
 * Reduced motion stops the scroll and the thumbs-up (globals.css, star LP kit).
 */
export function StarLpMarquee({ words, between, ground }: StarLpMarqueeProps) {
    const strip = ground ?? marqueeStripGround(between)
    // A strip of plain words repeats itself many times over; screen readers get nothing from it.
    const decorative = words.every((word) => typeof word === 'string')
    return (
        <div
            className={twMerge(
                'star-lp-marquee h-[60px] overflow-hidden border-y-2 border-border-default',
                BAND_GROUND_CLASS[strip]
            )}
            aria-hidden={decorative || undefined}
        >
            {/* The strip's own rules sit under the wrapper's. */}
            <div className="-my-0.5">
                <Marquee message={words} backgroundColor={BAND_GROUND_CLASS[strip]} />
            </div>
        </div>
    )
}
