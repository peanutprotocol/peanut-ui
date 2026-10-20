/** @jest-environment node */
import { marqueeStripGround, seamNeedsMarquee } from '@/components/Marketing/StarLp/starLpMarquee.utils'

describe('marqueeStripGround', () => {
    it('takes the first colour neither neighbour has', () => {
        expect(marqueeStripGround(['pink', 'yellow'])).toBe('sky')
        expect(marqueeStripGround(['sky', 'black'])).toBe('yellow')
        expect(marqueeStripGround(['yellow', 'sky'])).toBe('pink')
    })

    it('treats cream as white', () => {
        expect(marqueeStripGround(['cream', 'pink'])).toBe('yellow')
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
