import { minorUnitDigits, payerAmount } from '../payerAmount'

describe('minorUnitDigits', () => {
    it('reads the decimals the currency is paid in', () => {
        expect(minorUnitDigits('EUR')).toBe(2)
        expect(minorUnitDigits('JPY')).toBe(0)
    })

    it('falls back to two on a code it does not know', () => {
        expect(minorUnitDigits('NOPE')).toBe(2)
    })
})

describe('payerAmount', () => {
    it('converts the requested dollars at the given rate', () => {
        expect(payerAmount('250', 'EUR', 0.92)).toBe(230)
    })

    // Rounding down leaves the request short of what it asked for, so the
    // payer is always asked for the next whole minor unit.
    it('rounds up to the smallest unit the currency has', () => {
        expect(payerAmount('250', 'EUR', 0.9237)).toBe(230.93)
        expect(payerAmount('10', 'JPY', 147.2)).toBe(1472)
        expect(payerAmount('10', 'JPY', 147.21)).toBe(1473)
    })

    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would charge a cent nobody owes.
    it('does not round up an amount that is already exact', () => {
        expect(payerAmount('8.29', 'USD', 1)).toBe(8.29)
        expect(payerAmount('250', 'USD', 1)).toBe(250)
    })

    it('passes a dollar account through whatever the rate says', () => {
        expect(payerAmount('250', 'USD', 0)).toBe(250)
    })

    // A wrong number is worse than no number: the payer would send it.
    it('gives no amount without a rate', () => {
        expect(payerAmount('250', 'EUR', 0)).toBeUndefined()
    })

    it('gives no amount for a request that asks for none', () => {
        expect(payerAmount(undefined, 'EUR', 0.92)).toBeUndefined()
        expect(payerAmount('0', 'EUR', 0.92)).toBeUndefined()
        expect(payerAmount('abc', 'EUR', 0.92)).toBeUndefined()
    })
})
