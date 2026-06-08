// Locks receipt-kind resolution, including the legacy `?t=` back-compat that
// keeps pre-decomplexify shared receipt links from 404ing.

import { isIntentKind, resolveReceiptKind } from '../registry'

describe('isIntentKind', () => {
    test('accepts a canonical kind', () => {
        expect(isIntentKind('SEND_LINK')).toBe(true)
        expect(isIntentKind('QR_PAY')).toBe(true)
    })

    test('rejects unknown values', () => {
        expect(isIntentKind('NOPE')).toBe(false)
        expect(isIntentKind(undefined)).toBe(false)
        expect(isIntentKind(9)).toBe(false)
    })
})

describe('resolveReceiptKind', () => {
    test('prefers the current ?kind= param', () => {
        expect(resolveReceiptKind('OFFRAMP', undefined)).toBe('OFFRAMP')
        // a valid kind wins even if a (stale) legacy t is also present
        expect(resolveReceiptKind('SEND_LINK', '9')).toBe('SEND_LINK')
    })

    // The five legacy EHistoryEntryType indices that ever produced a shareable
    // receipt URL before the ?kind= migration (commit b5a0fa2b).
    test.each([
        ['3', 'SEND_LINK'],
        ['9', 'QR_PAY'], // Manteca QR
        ['10', 'OFFRAMP'],
        ['11', 'ONRAMP'],
        ['13', 'QR_PAY'], // SimpleFi QR
    ])('maps legacy ?t=%s to kind %s', (t, expected) => {
        expect(resolveReceiptKind(undefined, t)).toBe(expected)
    })

    test('takes the first value when searchParams hands back an array', () => {
        expect(resolveReceiptKind(['SEND_LINK', 'QR_PAY'], undefined)).toBe('SEND_LINK')
        expect(resolveReceiptKind(undefined, ['9', '10'])).toBe('QR_PAY')
    })

    test('returns undefined when neither param resolves a kind', () => {
        expect(resolveReceiptKind(undefined, undefined)).toBeUndefined()
        expect(resolveReceiptKind('NOPE', '999')).toBeUndefined()
        // a legacy index that never had a shareable receipt stays unmapped
        expect(resolveReceiptKind(undefined, '4')).toBeUndefined()
    })
})
