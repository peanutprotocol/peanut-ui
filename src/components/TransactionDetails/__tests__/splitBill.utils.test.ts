// Locks the "Split this bill" CTA URL build — the merchant fallback + URL-encoding
// (the latter was a CodeRabbit finding: "Tigers & Lions" must not break the query).
import { buildSplitBillRequestUrl } from '../splitBill.utils'

describe('buildSplitBillRequestUrl', () => {
    test('includes amount + merchant for a normal merchant', () => {
        expect(buildSplitBillRequestUrl(15, 'Cafe Tortoni')).toBe('/request?amount=15&merchant=Cafe%20Tortoni')
    })

    test('URL-encodes reserved characters in the merchant name', () => {
        expect(buildSplitBillRequestUrl(20, 'Tigers & Lions')).toBe('/request?amount=20&merchant=Tigers%20%26%20Lions')
    })

    test('omits the merchant param for the "Card payment" fallback', () => {
        expect(buildSplitBillRequestUrl(12.5, 'Card payment')).toBe('/request?amount=12.5')
    })

    test('omits the merchant param when there is no merchant name', () => {
        expect(buildSplitBillRequestUrl(8)).toBe('/request?amount=8')
        expect(buildSplitBillRequestUrl(8, null)).toBe('/request?amount=8')
        expect(buildSplitBillRequestUrl(8, '')).toBe('/request?amount=8')
    })

    test('strips a leading minus so the prefill amount is never negative', () => {
        expect(buildSplitBillRequestUrl(-15, 'Cafe Tortoni')).toBe('/request?amount=15&merchant=Cafe%20Tortoni')
        expect(buildSplitBillRequestUrl('-12.5')).toBe('/request?amount=12.5')
        expect(buildSplitBillRequestUrl(-20n)).toBe('/request?amount=20')
    })
})
