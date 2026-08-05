import { createTranslator } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
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
    // Same shape the components pass in (useTranslations('badges')), built from
    // the real en catalog so these tests exercise the actual message keys.
    const t = createTranslator({ locale: 'en', messages: en, namespace: 'badges' }) as unknown as Parameters<
        typeof getBadgeShareText
    >[0]

    it('uses the badge-specific brag line for a known code (not the generic fallback) and appends the profile url', () => {
        // Copy-agnostic on purpose: assert a mapped code yields something OTHER than
        // the generic fallback, so editing a line never breaks this test.
        const mapped = getBadgeShareText(t, 'CARD_FIRST_SWIPE', 'First Swipe', url)
        const fallback = getBadgeShareText(t, '___UNMAPPED___', 'First Swipe', url)
        expect(mapped).not.toBe(fallback)
        expect(mapped).toContain(url)
        // first-person voice — the sharer is bragging about themselves
        expect(mapped).toMatch(/\b(I|my)\b/i)
    })

    it('falls back to a generic brag (with display name) for unknown / parked codes', () => {
        const text = getBadgeShareText(t, 'NOT_A_REAL_BADGE', 'Mystery Badge', url)
        expect(text).toContain('Mystery Badge')
        expect(text).toContain(url)
    })

    it('still produces shareable text when the code is undefined', () => {
        const text = getBadgeShareText(t, undefined, 'Some Badge', url)
        expect(text).toContain('Some Badge')
        expect(text).toContain(url)
    })

    it('every share line in the catalog maps to a real badge code (typo guard)', () => {
        // The reverse is NOT asserted: rarely-earned badges intentionally have no
        // bespoke line and ride the generic fallback with zero copy upkeep.
        const lineCodes = Object.keys(en.badges.share.lines)
        const unknown = lineCodes.filter((code) => !(code in BADGES))
        expect(unknown).toEqual([])
    })
})
