import { BADGES, getBadgeIcon } from '../badge.utils'

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
