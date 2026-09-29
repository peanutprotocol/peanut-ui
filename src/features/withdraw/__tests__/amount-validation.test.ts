import { parseUnits } from 'viem'
import { type Account, AccountType } from '@/interfaces/interfaces'
import { bankAmountCurrency } from '../bank-amount'
import { bankPayoutMinimum, meetsBankPayoutMinimum, validateBankOfframpAmount } from '../amount-validation'

const savedAccountWithoutCountry = (type: AccountType): Account =>
    ({
        type,
        details: { countryCode: '', countryName: '' },
    }) as Account

// The bank-offramp amount arrives via a user-editable URL param — the submit
// handler revalidates it synchronously (Chip review, PR #2917).
describe('validateBankOfframpAmount', () => {
    const balance = parseUnits('100', 6)

    it('rejects zero', () => {
        expect(validateBankOfframpAmount('0', balance)).toEqual({ ok: false, reason: 'invalid' })
    })

    it('rejects malformed and non-finite values', () => {
        for (const raw of ['abc', '', 'NaN', 'Infinity', '-5', '1e309']) {
            expect(validateBankOfframpAmount(raw, balance)).toEqual({ ok: false, reason: 'invalid' })
        }
    })

    it('rejects non-plain-decimal raw syntax even when Number() would accept it (Chip P13)', () => {
        for (const raw of ['5e1', '0x10', ' 50', '50 ', '+5', '5,5']) {
            expect(validateBankOfframpAmount(raw, balance)).toEqual({ ok: false, reason: 'invalid' })
        }
    })

    it('rejects amounts under the $1 Bridge floor', () => {
        expect(validateBankOfframpAmount('0.5', balance)).toEqual({ ok: false, reason: 'belowMinimum' })
    })

    it('rejects amounts over the displayed spendable balance', () => {
        expect(validateBankOfframpAmount('150', balance)).toEqual({ ok: false, reason: 'insufficientBalance' })
    })

    it('refuses while the balance is still loading — no ceiling means no pass (Chip round 3)', () => {
        expect(validateBankOfframpAmount('150', undefined)).toEqual({ ok: false, reason: 'balanceLoading' })
        expect(validateBankOfframpAmount('5', undefined)).toEqual({ ok: false, reason: 'balanceLoading' })
    })

    // The provider is promised this exact figure and matches the deposit on
    // it, while the chain can only carry 6 decimals: viem rounds rather than
    // throwing, so a longer fraction sent LESS than the provider was told and
    // the transfer sat awaiting funds with the money already gone.
    it('rejects a fraction the chain cannot carry', () => {
        for (const raw of ['5.1234564', '5.12345649', '1.0000001']) {
            expect(validateBankOfframpAmount(raw, balance)).toEqual({ ok: false, reason: 'invalid' })
        }
    })

    it('accepts a fraction of exactly six decimals', () => {
        expect(validateBankOfframpAmount('5.123456', balance)).toEqual({ ok: true, normalized: '5.123456' })
    })

    it('accepts and normalizes valid amounts — the wire never sees the raw param', () => {
        expect(validateBankOfframpAmount('50', balance)).toEqual({ ok: true, normalized: '50' })
        expect(validateBankOfframpAmount('050.10', balance)).toEqual({ ok: true, normalized: '50.1' })
        // honest mid-typing decimals are tolerated and normalized
        expect(validateBankOfframpAmount('2.', balance)).toEqual({ ok: true, normalized: '2' })
        expect(validateBankOfframpAmount('50.', balance)).toEqual({ ok: true, normalized: '50' })
    })
})

// The payout minimum is compared in the currency the bank is paid in, so the
// minimum itself is accepted as typed (TASK-23054). The old USD conversion,
// rounded up, refused exactly 50 MXN.
describe('meetsBankPayoutMinimum', () => {
    it.each([
        ['mxn', 50, 49.99],
        ['gbp', 3, 2.99],
        ['cop', 4000, 3999.99],
        ['eur', 1, 0.99],
        ['usd', 1, 0.99],
    ])('%s: exactly %d passes, %d is refused', (currency, minimum, below) => {
        expect(bankPayoutMinimum(currency)).toBe(minimum)
        expect(meetsBankPayoutMinimum(minimum, currency)).toBe(true)
        expect(meetsBankPayoutMinimum(below, currency)).toBe(false)
    })

    it('reads the currency in any case, and a missing one has the 1 minimum', () => {
        expect(bankPayoutMinimum('MXN')).toBe(50)
        expect(bankPayoutMinimum(null)).toBe(1)
    })

    it('an amount that is not a number never passes', () => {
        expect(meetsBankPayoutMinimum(Number.NaN, 'mxn')).toBe(false)
        expect(meetsBankPayoutMinimum(Number.NaN, 'eur')).toBe(false)
    })

    it.each([
        [AccountType.GB, 3],
        [AccountType.CLABE, 50],
    ])('a saved %s account with blank country metadata still gets its currency minimum', (type, minimum) => {
        expect(bankPayoutMinimum(bankAmountCurrency(savedAccountWithoutCountry(type)))).toBe(minimum)
    })
})

describe('validateBankOfframpAmount — the $1 Bridge floor', () => {
    const balance = 100n * 10n ** 6n

    it('refuses under $1 and passes at it', () => {
        expect(validateBankOfframpAmount('0.99', balance)).toEqual({ ok: false, reason: 'belowMinimum' })
        expect(validateBankOfframpAmount('1', balance)).toEqual({ ok: true, normalized: '1' })
    })
})
