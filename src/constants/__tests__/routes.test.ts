import { couldBeRecipient, isLocaleSegment, isReservedRoute } from '@/constants/routes'

describe('couldBeRecipient — catch-all guard', () => {
    test('accepts valid Peanut usernames', () => {
        expect(couldBeRecipient('hugo0')).toBe(true)
        expect(couldBeRecipient('konrad')).toBe(true)
        expect(couldBeRecipient('alice123')).toBe(true)
    })

    test('accepts EVM addresses and ENS names', () => {
        expect(couldBeRecipient('0x1234567890123456789012345678901234567890')).toBe(true)
        expect(couldBeRecipient('vitalik.eth')).toBe(true)
    })

    test('accepts username@chain handles', () => {
        expect(couldBeRecipient('hugo0@arbitrum')).toBe(true)
        expect(couldBeRecipient('hugo0@optimism')).toBe(true)
    })

    test('rejects bare 2-letter locale codes (the /es/argentina regression)', () => {
        expect(couldBeRecipient('es')).toBe(false)
        expect(couldBeRecipient('pt')).toBe(false)
        expect(couldBeRecipient('en')).toBe(false)
        expect(couldBeRecipient('fr')).toBe(false)
        expect(couldBeRecipient('de')).toBe(false)
    })

    test('rejects strings shorter than the username minimum', () => {
        expect(couldBeRecipient('a')).toBe(false)
        expect(couldBeRecipient('ab')).toBe(false)
        expect(couldBeRecipient('abc')).toBe(false)
    })

    test('rejects strings with characters usernames forbid', () => {
        expect(couldBeRecipient('send-money-to')).toBe(false)
        expect(couldBeRecipient('123foo')).toBe(false)
        expect(couldBeRecipient('foo.bar')).toBe(false)
    })

    test('case-insensitive: uppercase usernames resolve via lowercasing', () => {
        // matches the existing PaymentPage behavior — recipient is lowercased before lookup
        expect(couldBeRecipient('UPPER')).toBe(true)
        expect(couldBeRecipient('Hugo0')).toBe(true)
    })

    test('rejects empty / undefined-shaped input', () => {
        expect(couldBeRecipient('')).toBe(false)
    })
})

describe('isLocaleSegment', () => {
    test('matches locale codes with a subtag', () => {
        expect(isLocaleSegment('pt-br')).toBe(true)
        expect(isLocaleSegment('es-419')).toBe(true)
        expect(isLocaleSegment('zh-Hans')).toBe(true)
    })

    test('does NOT match bare 2-letter codes (those rely on DEDICATED_ROUTES + redirects.json)', () => {
        expect(isLocaleSegment('es')).toBe(false)
        expect(isLocaleSegment('pt')).toBe(false)
    })
})

describe('isReservedRoute', () => {
    test('catches DEDICATED_ROUTES entries', () => {
        expect(isReservedRoute('/home')).toBe(true)
        expect(isReservedRoute('/send')).toBe(true)
        expect(isReservedRoute('/es-419')).toBe(true)
    })

    test('catches subtagged locales via isLocaleSegment', () => {
        expect(isReservedRoute('/zh-Hans')).toBe(true)
    })

    test('does not flag plausible usernames', () => {
        expect(isReservedRoute('/hugo0')).toBe(false)
    })
})
