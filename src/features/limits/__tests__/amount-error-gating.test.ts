import { shouldShowAmountError } from '../amount-error-gating'
import { getLimitsWarningCardProps, type LimitValidationResult } from '../utils'

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

describe('the bank flows derive showsLimitsCard from the card props', () => {
    // The bank on-ramp and the Manteca off-ramp used to pass a hardcoded
    // `true`. They now pass `!!getLimitsWarningCardProps(...)` — the same value
    // the card itself is rendered from — so the message can never be suppressed
    // by a card that is not on the screen.
    const blocking: LimitValidationResult = {
        isBlocking: true,
        isWarning: false,
        remainingLimit: 100,
        totalLimit: 1000,
        message: 'Amount exceeds your remaining limit',
        daysUntilReset: 12,
        limitCurrency: 'USD',
    }
    const withinLimit: LimitValidationResult = {
        ...blocking,
        isBlocking: false,
        isWarning: false,
        message: null,
    }

    const showsAmountError = (validation: LimitValidationResult) =>
        shouldShowAmountError({
            showError: true,
            showsLimitsCard: !!getLimitsWarningCardProps({ validation, flowType: 'offramp', currency: 'USD' }),
            limitsBlocking: validation.isBlocking,
        })

    it('keeps the message when no card renders', () => {
        expect(getLimitsWarningCardProps({ validation: withinLimit, flowType: 'offramp', currency: 'USD' })).toBeNull()
        expect(showsAmountError(withinLimit)).toBe(true)
    })

    it('yields to the card when one renders', () => {
        expect(getLimitsWarningCardProps({ validation: blocking, flowType: 'offramp', currency: 'USD' })).not.toBeNull()
        expect(showsAmountError(blocking)).toBe(false)
    })
})
