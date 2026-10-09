import { isPriceFreshForConversion } from '../token-price.utils'

describe('isPriceFreshForConversion', () => {
    it('refuses a price the API flagged stale', () => {
        expect(isPriceFreshForConversion({ stale: true })).toBe(false)
    })

    it('accepts a live price, and one with no flag (client-side $1 stablecoin, or an older API)', () => {
        expect(isPriceFreshForConversion({ stale: false })).toBe(true)
        expect(isPriceFreshForConversion({})).toBe(true)
    })
})
