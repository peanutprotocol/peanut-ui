import { formatBankAmount } from '@/utils/currency'

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
