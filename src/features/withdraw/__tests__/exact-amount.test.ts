import { AccountType, type Account } from '@/interfaces/interfaces'
import { exactAmountCurrency } from '../exact-amount'

const account = (type: AccountType) => ({ id: 'a', type }) as unknown as Account

describe('exactAmountCurrency', () => {
    it.each([
        [AccountType.IBAN, 'eur'],
        [AccountType.GB, 'gbp'],
        [AccountType.CLABE, 'mxn'],
        [AccountType.CO_BANK_TRANSFER, 'cop'],
    ])('a %s account takes an exact amount in %s', (type, currency) => {
        expect(exactAmountCurrency(account(type))).toBe(currency)
    })

    it('a US account has none: USD pays 1:1 from USDC', () => {
        expect(exactAmountCurrency(account(AccountType.US))).toBeNull()
    })

    it('a Manteca account has none: it is not a Bridge payout', () => {
        expect(exactAmountCurrency(account(AccountType.MANTECA))).toBeNull()
    })

    it('no account, no exact amount', () => {
        expect(exactAmountCurrency(null)).toBeNull()
    })
})
