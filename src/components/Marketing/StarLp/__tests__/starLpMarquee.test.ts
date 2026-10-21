/** @jest-environment node */
import { marqueeStripGround, seamNeedsMarquee } from '@/components/Marketing/StarLp/starLpMarquee.utils'

describe('marqueeStripGround', () => {
    it('takes the first colour neither neighbour has', () => {
        expect(marqueeStripGround(['pink', 'yellow'])).toBe('sky')
        expect(marqueeStripGround(['sky', 'black'])).toBe('pink')
        expect(marqueeStripGround(['yellow', 'sky'])).toBe('pink')
        expect(marqueeStripGround(['pink', 'sky'])).toBe('white')
    })

    it('never picks yellow (design.md: the yellow marquee is home-only)', () => {
        const grounds = ['pink', 'cream', 'sky', 'yellow', 'black', 'white'] as const
        for (const above of grounds)
            for (const below of grounds) {
                expect(marqueeStripGround([above, below])).not.toBe('yellow')
            }
    })

    it('treats cream as white', () => {
        expect(marqueeStripGround(['cream', 'pink'])).toBe('sky')
        expect(marqueeStripGround(['white', 'yellow'])).toBe('sky')
    })
})

describe('seamNeedsMarquee', () => {
    it('marks a seam with a pink, sky or yellow side', () => {
        expect(seamNeedsMarquee(['pink', 'black'])).toBe(true)
        expect(seamNeedsMarquee(['cream', 'sky'])).toBe(true)
        expect(seamNeedsMarquee(['white', 'yellow'])).toBe(true)
    })

    it('skips white, cream and black pairs', () => {
        expect(seamNeedsMarquee(['black', 'cream'])).toBe(false)
        expect(seamNeedsMarquee(['white', 'black'])).toBe(false)
    })
})
