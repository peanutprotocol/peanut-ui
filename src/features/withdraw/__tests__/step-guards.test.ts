import { bankStepGuards, cryptoStepGuards, mantecaStepGuards } from '../step-guards'

// URL-tampering regressions (Chip review, PR #2917): the ?step= param is
// user-editable, so a terminal screen must demand execution proof — state set
// only after the money operation succeeded. Guard behavior itself (fallback
// resolution, URL rewrite) is covered by useFlowStepper.test.

describe('bankStepGuards', () => {
    it('refuses ?step=success before confirmOfframp succeeded — even with account+amount present', () => {
        expect(bankStepGuards({ executed: false }).success).toEqual({ ok: false, fallback: 'review' })
    })

    it('admits the success step once the offramp completed', () => {
        expect(bankStepGuards({ executed: true }).success?.ok).toBe(true)
    })
})

describe('cryptoStepGuards', () => {
    it('refuses ?step=success with prepared charge data but no broadcast tx', () => {
        const guards = cryptoStepGuards({ hasDestination: true, prepared: true, executed: false })
        expect(guards.success?.ok).toBe(false)
        expect(guards.review?.ok).toBe(true)
    })

    it('refuses review and success with nothing prepared', () => {
        const guards = cryptoStepGuards({ hasDestination: true, prepared: false, executed: false })
        expect(guards.review?.ok).toBe(false)
        expect(guards.success?.ok).toBe(false)
    })

    it('admits success only with charge data AND a transaction identifier', () => {
        expect(cryptoStepGuards({ hasDestination: true, prepared: true, executed: true }).success?.ok).toBe(true)
        // an execution marker without prepared data is not a renderable success
        expect(cryptoStepGuards({ hasDestination: true, prepared: false, executed: true }).success?.ok).toBe(false)
    })
})

describe('mantecaStepGuards', () => {
    it('refuses ?step=success and ?step=failure before the submission ran', () => {
        const guards = mantecaStepGuards({ hasDestination: true, hasAmount: true, priceLocked: true, outcome: null })
        expect(guards.success?.ok).toBe(false)
        expect(guards.failure?.ok).toBe(false)
        expect(guards.review?.ok).toBe(true)
    })

    it('admits exactly the step matching the recorded outcome', () => {
        const success = mantecaStepGuards({
            hasDestination: true,
            hasAmount: true,
            priceLocked: true,
            outcome: 'success',
        })
        expect(success.success?.ok).toBe(true)
        expect(success.failure?.ok).toBe(false)
        const failure = mantecaStepGuards({
            hasDestination: true,
            hasAmount: true,
            priceLocked: true,
            outcome: 'failure',
        })
        expect(failure.failure?.ok).toBe(true)
        expect(failure.success?.ok).toBe(false)
    })

    it('allows destination entry without an amount, but requires a price lock for review', () => {
        const guards = mantecaStepGuards({ hasDestination: true, hasAmount: false, priceLocked: false, outcome: null })
        expect(guards['bank-details']).toBeUndefined()
        expect(guards.amount?.ok).toBe(true)
        expect(guards.review?.ok).toBe(false)
    })
})

it('rejects amount deep links before a destination is selected', () => {
    expect(
        mantecaStepGuards({ hasDestination: false, hasAmount: true, priceLocked: false, outcome: null }).amount?.ok
    ).toBe(false)
    expect(cryptoStepGuards({ hasDestination: false, prepared: false, executed: false }).amount?.ok).toBe(false)
})
