import { BADGES, getBadgeIcon } from '../badge.utils'

// jest-transform-stub turns svg imports into a bare string, so mock the mascot
// module to mirror the real StaticImageData shape — the fallback must unwrap .src.
jest.mock('@/assets/mascot', () => ({
    PEANUTMAN_LOGO: { src: '/peanut-logo-stub.svg' },
}))

describe('getBadgeIcon', () => {
    it('returns the badge path for known codes', () => {
        expect(getBadgeIcon('WAITLIST_SKIP')).toBe(BADGES.WAITLIST_SKIP.path)
    })

    it('falls back to a string URL for unknown codes (raw <img src> consumers)', () => {
        // Unknown codes happen in prod when the FE BADGES map drops a code the BE
        // still awards (the recurring badge-registry silent-drop incident).
        expect(getBadgeIcon('NOT_A_REAL_BADGE')).toBe('/peanut-logo-stub.svg')
        expect(getBadgeIcon(undefined)).toBe('/peanut-logo-stub.svg')
    })
})
