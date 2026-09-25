import { AccountType, type Account } from '@/interfaces/interfaces'
import { bankAmountCurrency, normalizeBankAmount } from '../bank-amount'

const account = (type: AccountType) => ({ id: 'a', type }) as unknown as Account

describe('bankAmountCurrency', () => {
    it.each([
        [AccountType.IBAN, 'eur'],
        [AccountType.GB, 'gbp'],
        [AccountType.CLABE, 'mxn'],
        [AccountType.CO_BANK_TRANSFER, 'cop'],
    ])('a %s account is typed in %s', (type, currency) => {
        expect(bankAmountCurrency(account(type))).toBe(currency)
    })

    it('a US account keeps USD: it pays 1:1 from USDC', () => {
        expect(bankAmountCurrency(account(AccountType.US))).toBeNull()
    })

    it('a Manteca account is not a Bridge payout', () => {
        expect(bankAmountCurrency(account(AccountType.MANTECA))).toBeNull()
    })

    it('no account, no bank currency', () => {
        expect(bankAmountCurrency(null)).toBeNull()
    })
})

describe('normalizeBankAmount', () => {
    it.each([
        ['90', '90'],
        ['90.', '90'],
        ['.5', '0.5'],
        ['2,000.50', '2000.50'],
    ])('%s is sent as %s', (typed, sent) => {
        expect(normalizeBankAmount(typed)).toBe(sent)
    })

    it.each(['', '0', '0.', '.', '0.00', '1.234', 'abc', '1e3', '-5'])('%s is no amount', (typed) => {
        expect(normalizeBankAmount(typed)).toBeNull()
    })
})
