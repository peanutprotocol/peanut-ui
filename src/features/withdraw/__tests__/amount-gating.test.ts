import { shouldShowAmountError } from '../amount-gating'

describe('shouldShowAmountError (TASK-21666)', () => {
    it('never renders without an error', () => {
        expect(shouldShowAmountError({ showError: false, isCryptoWithdraw: true, limitsBlocking: true })).toBe(false)
        expect(shouldShowAmountError({ showError: false, isCryptoWithdraw: false, limitsBlocking: false })).toBe(false)
    })

    it('crypto: the balance error shows at every magnitude — even while limits are blocking', () => {
        // The regression: amount above both balance and the off-ramp limit
        // rendered nothing (no limits card for crypto + banner suppressed).
        expect(shouldShowAmountError({ showError: true, isCryptoWithdraw: true, limitsBlocking: true })).toBe(true)
        expect(shouldShowAmountError({ showError: true, isCryptoWithdraw: true, limitsBlocking: false })).toBe(true)
    })

    it('fiat: the limits card replaces the banner while blocking', () => {
        expect(shouldShowAmountError({ showError: true, isCryptoWithdraw: false, limitsBlocking: true })).toBe(false)
        expect(shouldShowAmountError({ showError: true, isCryptoWithdraw: false, limitsBlocking: false })).toBe(true)
    })
})
