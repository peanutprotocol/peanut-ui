import { parseUnits } from 'viem'
import { validateBankOfframpAmount, bankWithdrawMinUsd, bankWithdrawMinNeedsRate } from '../amount-validation'

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

    it('accepts and normalizes valid amounts — the wire never sees the raw param', () => {
        expect(validateBankOfframpAmount('50', balance)).toEqual({ ok: true, normalized: '50' })
        expect(validateBankOfframpAmount('050.10', balance)).toEqual({ ok: true, normalized: '50.1' })
        // honest mid-typing decimals are tolerated and normalized
        expect(validateBankOfframpAmount('2.', balance)).toEqual({ ok: true, normalized: '2' })
        expect(validateBankOfframpAmount('50.', balance)).toEqual({ ok: true, normalized: '50' })
    })
})

describe('bankWithdrawMinUsd', () => {
    it('US and unknown destinations: the $1 floor, no rate needed', () => {
        expect(bankWithdrawMinUsd('US', undefined)).toBe(1)
        expect(bankWithdrawMinUsd('', undefined)).toBe(1)
        expect(bankWithdrawMinNeedsRate('US')).toBe(false)
    })

    it('EUR destinations: €1 ≈ $1, no rate needed', () => {
        expect(bankWithdrawMinUsd('PT', undefined)).toBe(1)
        expect(bankWithdrawMinNeedsRate('PT')).toBe(false)
    })

    it('GB: £3 converts through the sell rate, rounded up', () => {
        expect(bankWithdrawMinUsd('GB', '0.79')).toBe(4) // ceil(3 / 0.79)
        expect(bankWithdrawMinNeedsRate('GB')).toBe(true)
    })

    it('MX: 50 MXN converts through the sell rate, rounded up', () => {
        expect(bankWithdrawMinUsd('MX', '17')).toBe(3) // ceil(50 / 17)
        expect(bankWithdrawMinNeedsRate('MX')).toBe(true)
    })

    it('falls back to the $1 Bridge floor while the rate loads — callers gate on bankWithdrawMinNeedsRate', () => {
        expect(bankWithdrawMinUsd('GB', undefined)).toBe(1)
        expect(bankWithdrawMinUsd('MX', '0')).toBe(1)
    })
})

describe('validateBankOfframpAmount with a destination rail minimum (Chip round 5)', () => {
    const balance = 100n * 10n ** 6n

    it('blocks below the converted minimum, passes at or above it', () => {
        expect(validateBankOfframpAmount('2', balance, 4)).toEqual({ ok: false, reason: 'belowMinimum' })
        expect(validateBankOfframpAmount('4', balance, 4)).toEqual({ ok: true, normalized: '4' })
    })

    it('the $1 Bridge floor always applies beneath the destination minimum', () => {
        expect(validateBankOfframpAmount('0.5', balance, 0)).toEqual({ ok: false, reason: 'belowMinimum' })
    })
})
