import { REJECTION_CAPTIONS, pickRejectionCaption } from '../rejectionCaptions'

describe('rejectionCaptions', () => {
    test('no caption hardcodes numbers/stats — they drift from the live door tally', () => {
        const withDigits = REJECTION_CAPTIONS.filter((c) => /\d/.test(c))
        expect(withDigits).toEqual([])
    })

    test('every caption tags @joinpeanut so the appeal rides the handle', () => {
        expect(REJECTION_CAPTIONS.every((c) => c.includes('@joinpeanut'))).toBe(true)
    })

    test('pickRejectionCaption returns a caption from the pool', () => {
        expect(REJECTION_CAPTIONS).toContain(pickRejectionCaption())
    })
})
