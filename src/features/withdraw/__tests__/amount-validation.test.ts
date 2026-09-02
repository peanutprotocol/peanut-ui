import { parseUnits } from 'viem'
import { validateBankOfframpAmount } from '../amount-validation'

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

    it('rejects amounts under the $1 Bridge floor', () => {
        expect(validateBankOfframpAmount('0.5', balance)).toEqual({ ok: false, reason: 'belowMinimum' })
    })

    it('rejects amounts over the displayed spendable balance', () => {
        expect(validateBankOfframpAmount('150', balance)).toEqual({ ok: false, reason: 'insufficientBalance' })
    })

    it('skips the balance ceiling while the balance is still loading', () => {
        expect(validateBankOfframpAmount('150', undefined)).toEqual({ ok: true, normalized: '150' })
    })

    it('accepts and normalizes valid amounts — the wire never sees the raw param', () => {
        expect(validateBankOfframpAmount('50', balance)).toEqual({ ok: true, normalized: '50' })
        expect(validateBankOfframpAmount('050.10', balance)).toEqual({ ok: true, normalized: '50.1' })
        // exponent notation normalizes to a plain decimal
        expect(validateBankOfframpAmount('5e1', balance)).toEqual({ ok: true, normalized: '50' })
    })
})
