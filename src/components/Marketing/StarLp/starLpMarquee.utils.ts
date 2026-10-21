import type { BandGround, ColouredGround, MarqueeStripGround } from './starLp.types'

/** No yellow: design.md § layout says "the yellow marquee is home-only." */
const STRIP_ORDER: readonly MarqueeStripGround[] = ['sky', 'pink', 'white']

/** The coloured grounds; a seam with one of them on either side gets a marquee. */
const COLOURED: readonly ColouredGround[] = ['pink', 'sky', 'yellow']

/** Cream reads as white on a seam, so a white strip never sits against either. */
const asStrip = (ground: BandGround): BandGround => (ground === 'cream' ? 'white' : ground)

/** The strip takes the first colour neither neighbour has, so it never blends into a fold. */
export function marqueeStripGround([above, below]: readonly [BandGround, BandGround]): MarqueeStripGround {
    const taken = [asStrip(above), asStrip(below)]
    return STRIP_ORDER.find((ground) => !taken.includes(ground)) ?? 'white'
}

/** A seam earns a marquee when either side is pink, sky or yellow; white, cream and black pairs skip it. */
export function seamNeedsMarquee([above, below]: readonly [BandGround, BandGround]): boolean {
    return COLOURED.some((ground) => ground === above || ground === below)
}
