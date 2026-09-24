import { AccountType, type Account } from '@/interfaces/interfaces'
import { bankAmountCurrency, quotableSourceAmount } from '../bank-amount'

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

// typed USDC on an older `?amount=` link, for an account the quote prices
describe('quotableSourceAmount', () => {
    it.each(['50', '50.1', '50.12', '0.5'])('takes %s as it is', (amount) => {
        expect(quotableSourceAmount(amount)).toBe(amount)
    })

    it.each([
        ['50.123456', '50.12'],
        ['50.129', '50.12'], // cut, never rounded up past what was asked
        ['.5', '0.5'],
        ['5.', '5'],
    ])('cuts %s to whole cents: %s', (amount, quotable) => {
        expect(quotableSourceAmount(amount)).toBe(quotable)
    })

    // each of these is refused by the submit's own amount check too
    it.each([
        '0.009', // under a cent
        '0',
        '',
        'abc',
        '5e1',
        '-5',
        '1.1234567', // more decimals than the token has
        '1234567890123', // more than the quote's 12 digits
    ])('refuses %s', (amount) => {
        expect(quotableSourceAmount(amount)).toBeNull()
    })
})
