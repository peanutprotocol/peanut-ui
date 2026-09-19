import { usdEquivalent } from '../requestCurrency'

describe('usdEquivalent', () => {
    // the rate is units of the request currency per dollar
    it('converts the asked amount into dollars', () => {
        expect(usdEquivalent('100', 0.8)).toBe('125.00')
        expect(usdEquivalent('13500', 1350)).toBe('10.00')
    })

    it('gives nothing without an amount or a rate', () => {
        expect(usdEquivalent('', 0.8)).toBe('')
        expect(usdEquivalent('0', 0.8)).toBe('')
        expect(usdEquivalent('abc', 0.8)).toBe('')
        expect(usdEquivalent('100', 0)).toBe('')
    })
})
