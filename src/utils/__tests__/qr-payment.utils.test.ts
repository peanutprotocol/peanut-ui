import { hasCardMarkupComparison } from '@/utils/qr-payment.utils'

describe('hasCardMarkupComparison', () => {
    it('compares against a card in ARS, where the official-rate gap is real', () => {
        expect(hasCardMarkupComparison('ARS')).toBe(true)
        expect(hasCardMarkupComparison('ars')).toBe(true)
    })

    // mono product/pricing.md row B-4: a foreign card that pays in BRL pays no IOF,
    // so Brazil gets no percentage and no card comparison.
    it('never compares against a card in BRL', () => {
        expect(hasCardMarkupComparison('BRL')).toBe(false)
        expect(hasCardMarkupComparison('brl')).toBe(false)
    })

    it('has no comparison without a currency', () => {
        expect(hasCardMarkupComparison(undefined)).toBe(false)
        expect(hasCardMarkupComparison(null)).toBe(false)
    })
})
