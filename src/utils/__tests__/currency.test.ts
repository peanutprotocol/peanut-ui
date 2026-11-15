import { formatAmountNumber, formatBankAmount, formatFiniteDisplay } from '@/utils/currency'

// One formatter for every bank amount a person reads — the rule lines on a
// virtual account, the "Recipient gets" row on a withdrawal, the request payer
// screen and the receipt headline: no ".00" on a round amount (design.md, copy).
describe('formatBankAmount', () => {
    it('drops the cents on a round amount', () => {
        expect(formatBankAmount('2000', 'eur')).toBe('€2,000')
        expect(formatBankAmount(4000, 'USD')).toBe('$4,000')
    })

    it('keeps the cents when there are any', () => {
        expect(formatBankAmount('1782.5', 'gbp')).toBe('£1,782.50')
    })

    it('rounds to the cent before deciding, so a sub-cent residue reads as round', () => {
        expect(formatBankAmount('1999.999', 'eur')).toBe('€2,000')
    })

    it('spaces a currency code that stands in for a symbol', () => {
        expect(formatBankAmount(13500, 'ARS')).toBe('ARS 13,500')
        expect(formatBankAmount(20.5, 'MXN')).toBe('MX$20.50')
    })
})

// The one place a display amount is rounded (design.md, copy → amounts).
describe('formatAmountNumber', () => {
    it('rounds half-up to the cent', () => {
        expect(formatAmountNumber('1.127608')).toBe('1.13')
        expect(formatAmountNumber(1.125)).toBe('1.13')
    })

    it('keeps a trailing zero and drops ".00" on a round amount', () => {
        expect(formatAmountNumber(0.5)).toBe('0.50')
        expect(formatAmountNumber('10')).toBe('10')
        expect(formatAmountNumber('105.9')).toBe('105.90')
    })

    it('never asks for more minimum decimals than the maximum allows', () => {
        expect(formatAmountNumber(1.5, 0)).toBe('2')
    })

    it('shows unparseable data as unavailable (TASK-24355)', () => {
        expect(formatAmountNumber('abc')).toBe('—')
    })
})

// Runtime display guard remains locale-aware and cannot manufacture a value.
describe('formatFiniteDisplay', () => {
    it('preserves formatting options and locale-specific separators', () => {
        expect(formatFiniteDisplay('4000.5', 'de-DE', { minimumFractionDigits: 2 })).toBe('4.000,50')
        expect(formatFiniteDisplay(0, 'en-US', { maximumFractionDigits: 0 })).toBe('0')
    })

    it('returns unavailable for bad values, units or formatting precision', () => {
        for (const value of [NaN, Infinity, -Infinity, '12garbage', '4,000', undefined, null]) {
            expect(formatFiniteDisplay(value)).toBe('—')
        }
        expect(formatFiniteDisplay(1, 'en-US', { maximumFractionDigits: -1 })).toBe('—')
        expect(formatBankAmount(1, '')).toBe('—')
        expect(formatAmountNumber(1, Infinity)).toBe('—')
    })
})
