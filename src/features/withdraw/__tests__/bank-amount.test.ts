import { AccountType, type Account } from '@/interfaces/interfaces'
import { bankAmountCurrency } from '../bank-amount'

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
