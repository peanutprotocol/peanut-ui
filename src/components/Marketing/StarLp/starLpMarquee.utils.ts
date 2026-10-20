import type { ColouredGround } from './starLp.types'

const STRIP_ORDER: readonly ColouredGround[] = ['yellow', 'sky', 'pink']

/** The strip takes the coloured ground neither neighbour has, so it never blends into a band. */
export function marqueeStripGround([above, below]: readonly [ColouredGround, ColouredGround]): ColouredGround {
    return STRIP_ORDER.find((ground) => ground !== above && ground !== below) ?? 'yellow'
}
