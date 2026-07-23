import { buildRejectionCaptions, pickRejectionCaption } from '../rejectionCaptions'

describe('rejectionCaptions', () => {
    test('numbers-flex caption uses the live door tally, not a hardcoded 213/7', () => {
        const captions = buildRejectionCaptions({ applicants: 275, admitted: 12 })
        expect(captions).toContain('275 tried, 12 got in. @joinpeanut said not me. yet.')
        expect(captions.some((c) => c.includes('213 tried'))).toBe(false)
    })

    test('large tallies are en-US formatted to match the screen copy', () => {
        const captions = buildRejectionCaptions({ applicants: 1500, admitted: 42 })
        expect(captions).toContain('1,500 tried, 42 got in. @joinpeanut said not me. yet.')
    })

    test('pickRejectionCaption returns a caption from the pool', () => {
        const tally = { applicants: 275, admitted: 12 }
        expect(buildRejectionCaptions(tally)).toContain(pickRejectionCaption(tally))
    })
})
