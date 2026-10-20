import type { BandGround, MarqueeStripGround } from './starLp.types'

const STRIP_ORDER: readonly MarqueeStripGround[] = ['yellow', 'sky', 'pink', 'white']

/** Cream reads as white on a seam, so a white strip never sits against either. */
const asStrip = (ground: BandGround): BandGround => (ground === 'cream' ? 'white' : ground)

/** The strip takes the first colour neither neighbour has, so it never blends into a fold. */
export function marqueeStripGround([above, below]: readonly [BandGround, BandGround]): MarqueeStripGround {
    const taken = [asStrip(above), asStrip(below)]
    return STRIP_ORDER.find((ground) => !taken.includes(ground)) ?? 'yellow'
}

/** A seam earns a marquee when either side is pink, sky or yellow; white, cream and black pairs skip it. */
export function seamNeedsMarquee([above, below]: readonly [BandGround, BandGround]): boolean {
    return STRIP_ORDER.slice(0, 3).some((ground) => ground === above || ground === below)
}
