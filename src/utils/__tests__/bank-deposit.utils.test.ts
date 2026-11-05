import { bankDepositAccountRows, bankDepositCurrency, bankDepositRail } from '@/utils/bank-deposit.utils'

/**
 * The bank details a user copies to pay a top-up. A wrong row costs a deposit:
 * on 2026-09-25 a UK top-up showed an IBAN and a BIC of "N/A" and "$7.00",
 * because the screen picked its rows from a country it had lost, while the
 * API's answer held the sort code, the account number and the currency.
 */
const GBP = {
    amount: '7.00',
    currency: 'gbp',
    sortCode: '04-00-53',
    accountNumber: '00000001',
    bankName: 'Fixture Bank',
}
const EUR = { amount: '40', currency: 'eur', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' }
const USD = { amount: '40', currency: 'usd', bankAccountNumber: '900000000001', bankRoutingNumber: '101019644' }
const MXN = { amount: '500', currency: 'mxn', clabe: '646180157000000004' }

describe('bankDepositCurrency', () => {
    it('reads the currency from the deposit instructions, over the country', () => {
        expect(bankDepositCurrency(GBP, undefined)).toBe('gbp')
        expect(bankDepositCurrency(GBP, 'US')).toBe('gbp')
        expect(bankDepositCurrency({ ...GBP, currency: 'GBP' }, 'DE')).toBe('gbp')
    })

    it('falls back to the country when the instructions name no currency', () => {
        expect(bankDepositCurrency({ amount: '7' }, 'GBR')).toBe('gbp')
        expect(bankDepositCurrency(undefined, 'MX')).toBe('mxn')
        expect(bankDepositCurrency(undefined, 'LI')).toBe('eur')
    })

    it('falls back to USD when neither is known', () => {
        expect(bankDepositCurrency(undefined, undefined)).toBe('usd')
    })
})

describe('bankDepositRail', () => {
    it.each([
        ['gbp', 'faster_payments'],
        ['GBP', 'faster_payments'],
        ['mxn', 'spei'],
        ['usd', 'ach'],
        ['eur', 'sepa'],
    ])('%s is paid over %s', (currency, rail) => {
        expect(bankDepositRail(currency)).toBe(rail)
    })

    it('pays an unlisted currency like SEPA, as before', () => {
        expect(bankDepositRail('chf')).toBe('sepa')
    })
})

describe('bankDepositAccountRows', () => {
    it('shows a UK top-up as sort code and account number, never IBAN and BIC', () => {
        expect(bankDepositAccountRows(GBP, bankDepositRail(bankDepositCurrency(GBP, undefined)))).toEqual([
            { label: 'sortCode', value: '04-00-53' },
            { label: 'accountNumber', value: '00000001' },
        ])
    })

    it('reads the UK account number from accountNumber, not the US bankAccountNumber', () => {
        const rows = bankDepositAccountRows({ ...GBP, bankAccountNumber: '999' }, 'faster_payments')
        expect(rows.find((row) => row.label === 'accountNumber')?.value).toBe('00000001')
    })

    it('shows a euro top-up as IBAN (grouped, copied raw) and BIC', () => {
        expect(bankDepositAccountRows(EUR, 'sepa')).toEqual([
            { label: 'iban', value: 'DE89 3704 0044 0532 0130 00', copyValue: 'DE89370400440532013000' },
            { label: 'bic', value: 'COBADEFFXXX' },
        ])
    })

    it('shows a dollar top-up as account number and routing number', () => {
        expect(bankDepositAccountRows(USD, 'ach')).toEqual([
            { label: 'accountNumber', value: '900000000001', copyValue: '900000000001' },
            { label: 'routingNumber', value: '101019644' },
        ])
    })

    it('shows a peso top-up as the CLABE alone', () => {
        expect(bankDepositAccountRows(MXN, 'spei')).toEqual([{ label: 'clabe', value: '646180157000000004' }])
    })

    it('leaves a detail the API did not give empty instead of borrowing another field', () => {
        expect(bankDepositAccountRows({ amount: '7', currency: 'gbp', iban: 'GB00' }, 'faster_payments')).toEqual([
            { label: 'sortCode', value: undefined },
            { label: 'accountNumber', value: undefined },
        ])
        expect(bankDepositAccountRows(undefined, 'sepa')).toEqual([
            { label: 'iban', value: undefined, copyValue: undefined },
            { label: 'bic', value: undefined },
        ])
    })
})
