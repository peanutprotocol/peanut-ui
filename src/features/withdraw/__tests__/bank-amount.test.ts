import { AccountType, type Account } from '@/interfaces/interfaces'
import { bankAmountCurrency, normalizeBankAmount, payoutAmounts } from '../bank-amount'

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

// TASK-23054 (Hugo): the currency the user typed leads on the review and
// success screens; the bank amount is "≈", the USD from the balance exact.
describe('payoutAmounts', () => {
    it.each([
        ['eur', '2000', '≈ €2,000'],
        ['gbp', '3.75', '≈ £3.75'],
        ['mxn', '500', '≈ MX$500'],
        ['cop', '40000', '≈ Col$40,000'],
    ])('typed in %s: the bank amount leads, the USD follows', (currency, amount, bank) => {
        expect(payoutAmounts('4.99', { currency, amount, enteredInBankCurrency: true })).toEqual({
            headline: bank,
            secondary: '$4.99',
        })
    })

    it('typed in USD: the USD leads, the bank amount follows', () => {
        expect(payoutAmounts('50', { currency: 'eur', amount: '45', enteredInBankCurrency: false })).toEqual({
            headline: '$50',
            secondary: '≈ €45',
        })
    })

    it('a USD payout, or a bank amount not quoted yet, has one amount', () => {
        expect(payoutAmounts('50', { currency: 'usd', enteredInBankCurrency: false })).toEqual({ headline: '$50' })
        expect(payoutAmounts('50', { currency: 'eur', enteredInBankCurrency: true })).toEqual({ headline: '$50' })
    })
})
