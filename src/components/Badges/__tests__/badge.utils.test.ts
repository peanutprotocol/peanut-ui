import { BADGES, getBadgeIcon, getBadgeShareText } from '../badge.utils'

describe('getBadgeIcon', () => {
    it('returns the badge path for known codes', () => {
        expect(getBadgeIcon('WAITLIST_SKIP')).toBe(BADGES.WAITLIST_SKIP.path)
    })

    it('falls back to a string URL for unknown codes (raw <img src> consumers)', () => {
        // Unknown codes happen in prod when the FE BADGES map drops a code the BE
        // still awards (the recurring badge-registry silent-drop incident). The
        // fallback must unwrap StaticImageData.src — never leak the object.
        expect(typeof getBadgeIcon('NOT_A_REAL_BADGE')).toBe('string')
        expect(getBadgeIcon('NOT_A_REAL_BADGE')).toBeTruthy()
        expect(getBadgeIcon(undefined)).toBe(getBadgeIcon('NOT_A_REAL_BADGE'))
    })
})

describe('getBadgeShareText', () => {
    const url = 'https://peanut.me/satoshi'

    it('uses the badge-specific brag line for a known code and appends the profile url', () => {
        const text = getBadgeShareText('CARD_FIRST_SWIPE', 'First Swipe', url)
        expect(text.toLowerCase()).toContain('swipe')
        expect(text).toContain(url)
        // first-person voice — the sharer is bragging about themselves
        expect(text).toMatch(/\b(I|my)\b/i)
    })

    it('falls back to a generic brag (with display name) for unknown / parked codes', () => {
        const text = getBadgeShareText('NOT_A_REAL_BADGE', 'Mystery Badge', url)
        expect(text).toContain('Mystery Badge')
        expect(text).toContain(url)
    })

    it('still produces shareable text when the code is undefined', () => {
        const text = getBadgeShareText(undefined, 'Some Badge', url)
        expect(text).toContain('Some Badge')
        expect(text).toContain(url)
    })
})
