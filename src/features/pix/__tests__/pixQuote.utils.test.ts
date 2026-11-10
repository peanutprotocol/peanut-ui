import { pixQuotePrice, pixTypedQuoteBrl } from '../pixQuote.utils'

describe('pixTypedQuoteBrl', () => {
    it("quotes the reais on screen once they reach the provider's minimum, else nothing", () => {
        expect(pixTypedQuoteBrl('503', '20')).toBe('503')
        expect(pixTypedQuoteBrl('100.505', '20')).toBe('100.5')
        expect(pixTypedQuoteBrl('19.99', '20')).toBeNull()
        expect(pixTypedQuoteBrl('', '20')).toBeNull()
        expect(pixTypedQuoteBrl(undefined, '20')).toBeNull()
        // the minimum comes from the first quote; before it, the amount waits
        expect(pixTypedQuoteBrl('503', null)).toBeNull()
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
