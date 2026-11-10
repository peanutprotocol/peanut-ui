import { isUnderPixMinimum, pixQuoteAmountBrl, pixQuotePrice } from '../pixQuote.utils'

describe('pixQuoteAmountBrl', () => {
    it("quotes the reais on screen once they reach the route's minimum, else the minimum", () => {
        expect(pixQuoteAmountBrl('503', '20')).toBe('503')
        expect(pixQuoteAmountBrl('100.505', '20')).toBe('100.5')
        // under the minimum, or nothing typed yet: the minimum, an amount the provider takes
        expect(pixQuoteAmountBrl('19.99', '20')).toBe('20')
        expect(pixQuoteAmountBrl('', '20')).toBe('20')
        expect(pixQuoteAmountBrl(undefined, '1')).toBe('1')
        // a route that states no minimum: the typed amount, and nothing before one
        expect(pixQuoteAmountBrl('503', null)).toBe('503')
        expect(pixQuoteAmountBrl(undefined, null)).toBeNull()
    })
})

describe('isUnderPixMinimum', () => {
    it("is true for a typed amount under the route's minimum only", () => {
        expect(isUnderPixMinimum('19.99', '20')).toBe(true)
        expect(isUnderPixMinimum('20', '20')).toBe(false)
        expect(isUnderPixMinimum('', '20')).toBe(false)
        expect(isUnderPixMinimum('0.5', '1')).toBe(true)
        expect(isUnderPixMinimum('0.5', null)).toBe(false)
    })
})

describe('pixQuotePrice', () => {
    it("is the quote's own BRL per USD, flat fee included, so the estimate matches the quote", () => {
        // PR B's withdraw example: R$106.75 out for 20.020325 USDC, the R$0.75 fee included
        expect(pixQuotePrice({ amountBrl: '106.75', usdcAmount: '20.020325' })! * 20.020325).toBeCloseTo(106.75, 6)
        expect(pixQuotePrice({ amountBrl: '0', usdcAmount: '1' })).toBeNull()
        expect(pixQuotePrice({ amountBrl: '10', usdcAmount: '0' })).toBeNull()
    })
})
