import {
    convertCurrencyAmount,
    defaultCurrencyForCountry,
    FALLBACK_FEE_SCHEDULE,
    getActiveFlatFeeForCurrency,
    getOrderedCurrencies,
    parseLocaleAmount,
} from '../rates-fees.utils'

describe('rates-fees.utils', () => {
    it('picks adaptable default currency and list ordering by user residence while keeping USD 1:1', () => {
        expect(defaultCurrencyForCountry('AR')).toBe('ARS')
        expect(defaultCurrencyForCountry('br')).toBe('BRL')
        expect(defaultCurrencyForCountry('MX')).toBe('MXN')
        expect(defaultCurrencyForCountry('CO')).toBe('COP')
        expect(defaultCurrencyForCountry('GB')).toBe('GBP')
        expect(defaultCurrencyForCountry('US')).toBe('USD')
        expect(defaultCurrencyForCountry('DE')).toBe('EUR')
        expect(defaultCurrencyForCountry(null)).toBe('EUR')

        const arOrder = getOrderedCurrencies('AR')
        expect(arOrder[0]).toBe('ARS')
        expect(arOrder).toContain('USD')
        expect(arOrder).toHaveLength(7)

        const brOrder = getOrderedCurrencies('BR')
        expect(brOrder[0]).toBe('BRL')
        expect(brOrder).toContain('USD')

        const defaultOrder = getOrderedCurrencies(undefined)
        expect(defaultOrder[0]).toBe('EUR')
        expect(defaultOrder).toContain('USD')
    })

    it('converts amounts bilaterally and deducts flat local fees on add money', () => {
        expect(convertCurrencyAmount({ amount: 178259, rate: 1782.59, direction: 'add' })).toBeCloseTo(100, 4)
        expect(convertCurrencyAmount({ amount: 100, rate: 1716.55, direction: 'withdraw' })).toBeCloseTo(171655, 2)
        expect(convertCurrencyAmount({ amount: 500, rate: 0.928, direction: 'add', flatFeeLocal: 0.5 })).toBeCloseTo(
            499.5 / 0.928,
            4
        )
        expect(convertCurrencyAmount({ amount: 0, rate: 100, direction: 'add' })).toBe(0)
    })

    it('parses locale-formatted numbers cleanly', () => {
        expect(parseLocaleAmount('100.000,50', 'es-AR')).toBe(100000.5)
        expect(parseLocaleAmount('100,000.50', 'en-US')).toBe(100000.5)
        expect(parseLocaleAmount('500', 'pt-BR')).toBe(500)
        expect(parseLocaleAmount('', 'en-US')).toBe(0)
    })

    it('surfaces only non-zero flat/provider fees and respects Brazil residency for Avenia Pix', () => {
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'ARS', 'add', 'AR')).toBeNull()
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'EUR', 'add', 'DE')).toBeNull()
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'USD', 'add', 'US')).toBeNull()
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'USD', 'withdraw', 'US')).toEqual({
            amount: 20,
            currency: 'USD',
            payer: 'provider',
            railHint: 'wire',
        })
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'BRL', 'add', 'AR')).toBeNull()
        expect(getActiveFlatFeeForCurrency(FALLBACK_FEE_SCHEDULE, 'BRL', 'add', 'BR')).toEqual({
            amount: 0.75,
            currency: 'BRL',
            payer: 'provider',
            railHint: undefined,
        })
    })
})
