import { shouldShowAmountError } from '../amount-error-gating'

describe('shouldShowAmountError (TASK-21666)', () => {
    it('never renders without an error', () => {
        expect(shouldShowAmountError({ showError: false, showsLimitsCard: false, limitsBlocking: true })).toBe(false)
        expect(shouldShowAmountError({ showError: false, showsLimitsCard: true, limitsBlocking: false })).toBe(false)
    })

    it('no limits card (crypto withdraw): the balance error shows at every magnitude — even while limits are blocking', () => {
        // The regression: amount above both balance and the off-ramp limit
        // rendered nothing (no limits card for crypto + banner suppressed).
        expect(shouldShowAmountError({ showError: true, showsLimitsCard: false, limitsBlocking: true })).toBe(true)
        expect(shouldShowAmountError({ showError: true, showsLimitsCard: false, limitsBlocking: false })).toBe(true)
    })

    it('with a limits card (fiat): the card replaces the banner while blocking', () => {
        expect(shouldShowAmountError({ showError: true, showsLimitsCard: true, limitsBlocking: true })).toBe(false)
        expect(shouldShowAmountError({ showError: true, showsLimitsCard: true, limitsBlocking: false })).toBe(true)
    })
})
