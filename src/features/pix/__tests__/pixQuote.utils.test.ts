import { pixQuoteAmountBrl, pixQuotePrice } from '../pixQuote.utils'

describe('pixQuoteAmountBrl', () => {
    it('quotes the reais on screen once they reach the minimum, else the minimum', () => {
        expect(pixQuoteAmountBrl('503', 20)).toBe('503')
        expect(pixQuoteAmountBrl('100.505', 20)).toBe('100.5')
        expect(pixQuoteAmountBrl('19.99', 20)).toBe('20')
        expect(pixQuoteAmountBrl('', 20)).toBe('20')
        expect(pixQuoteAmountBrl(undefined, 20)).toBe('20')
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
