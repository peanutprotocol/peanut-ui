import { formatAmountNumber, formatBankAmount } from '@/utils/currency'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

describe('unavailable amount display', () => {
    const invalid = [
        null,
        undefined,
        '',
        ' ',
        NaN,
        Infinity,
        -Infinity,
        'NaN',
        'Infinity',
        '1x',
        '1,000',
        '1e3',
        true,
        {},
        '9'.repeat(400),
    ]
    it.each(invalid.map((value, index) => ({ value, index })))(
        'renders invalid case $index as unavailable without a currency prefix',
        ({ value }) => {
            expect(formatAmountNumber(value as string)).toBe('—')
            for (const currency of ['USD', 'EUR', 'ARS']) expect(formatBankAmount(value as string, currency)).toBe('—')
        }
    )

    it('keeps valid zero, rounding, grouping and currency displays', () => {
        expect(formatAmountNumber(0)).toBe('0')
        expect(formatAmountNumber('1.125')).toBe('1.13')
        expect(formatAmountNumber('105.9')).toBe('105.90')
        expect(formatAmountNumber(1.5, 0)).toBe('2')
        expect(formatBankAmount('2000', 'EUR')).toBe('€2,000')
        expect(formatBankAmount('1782.5', 'GBP')).toBe('£1,782.50')
        expect(formatBankAmount('1999.999', 'EUR')).toBe('€2,000')
        expect(formatBankAmount(13500, 'ARS')).toBe('ARS 13,500')
        expect(formatBankAmount(0, 'USD')).toBe('$0')
    })
})
