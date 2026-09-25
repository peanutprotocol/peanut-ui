/**
 * The Home onboarding checklist rules (TASK-23054):
 * Create account ✓ · Verify identity · Add money · First payment.
 *
 * "Add money" is done on any money received or held (wallet or card
 * collateral) — $0.17 by crypto counts. "First payment" is done only
 * on the API activation (card spend or QR pay), and exists only for a user who
 * can make one; a user with neither card nor QR has three rows.
 */
import {
    type OnboardingInput,
    canHideChecklist,
    holdsMoney,
    resolveOnboarding,
    selectFirstPaymentRoute,
} from '@/utils/activation-step.utils'

const USDC = (usd: number) => BigInt(Math.round(usd * 1e6))

const base: OnboardingInput = {
    identityStatus: 'not_started',
    milestone: 'registered',
    isActivated: false,
    holdsMoney: false,
    firstPaymentRoute: 'card_qr',
    cardHeld: false,
}
const resolve = (overrides: Partial<OnboardingInput>) => resolveOnboarding({ ...base, ...overrides })

describe('holdsMoney', () => {
    it('is false with nothing in the wallet and no card balance', () => {
        expect(holdsMoney(0n, null)).toBe(false)
        expect(holdsMoney(undefined, undefined)).toBe(false)
        expect(holdsMoney(0n, { spendingPower: 0, inTransitToCollateralCents: 0 })).toBe(false)
    })

    it('counts $0.17 in the wallet', () => {
        expect(holdsMoney(USDC(0.17), null)).toBe(true)
    })

    it('counts card collateral when the wallet is empty', () => {
        expect(holdsMoney(0n, { spendingPower: 2500 })).toBe(true)
    })

    it('counts a collateral top-up still in transit', () => {
        expect(holdsMoney(0n, { spendingPower: 0, inTransitToCollateralCents: 17 })).toBe(true)
    })
})

describe('resolveOnboarding — every state on the page', () => {
    it('new user: nothing done, verify is next', () => {
        expect(resolve({})).toEqual({
            verify: 'todo',
            addMoneyDone: false,
            firstPaymentDone: false,
            firstPaymentRoute: 'card_qr',
            cardHeld: false,
            step: 'verify',
        })
    })

    it('ID check in review: the row is open but not actionable, so add money is next', () => {
        const state = resolve({ identityStatus: 'processing' })
        expect(state.verify).toBe('in_review')
        expect(state.step).toBe('add_money')
    })

    it('ID check needs action: back to to-do, verify is next', () => {
        expect(resolve({ identityStatus: 'action_required' }).step).toBe('verify')
    })

    it('verified, $0: add money is next', () => {
        const state = resolve({ identityStatus: 'verified', milestone: 'verified' })
        expect(state).toMatchObject({ verify: 'done', addMoneyDone: false, step: 'add_money' })
    })

    it('verified, $0.17 by crypto the ledger has not booked (milestone verified): add money done', () => {
        const state = resolve({
            identityStatus: 'verified',
            milestone: 'verified',
            holdsMoney: holdsMoney(USDC(0.17), null),
        })
        expect(state).toMatchObject({ addMoneyDone: true, step: 'first_payment' })
    })

    it('card collateral only (wallet 0): add money done', () => {
        const state = resolve({
            identityStatus: 'verified',
            milestone: 'verified',
            holdsMoney: holdsMoney(0n, { spendingPower: 2500 }),
        })
        expect(state.addMoneyDone).toBe(true)
    })

    it('bank top-up moved out again (milestone funded, $0 now): add money stays done', () => {
        expect(resolve({ identityStatus: 'verified', milestone: 'funded' }).addMoneyDone).toBe(true)
    })

    it('money in before the ID check: add money done, verify is still next', () => {
        const state = resolve({ milestone: 'funded', holdsMoney: true })
        expect(state).toMatchObject({ verify: 'todo', addMoneyDone: true, step: 'verify' })
    })

    it('activated (card spend or QR pay): completed', () => {
        const state = resolve({ identityStatus: 'verified', milestone: 'activated', isActivated: true })
        expect(state).toMatchObject({ addMoneyDone: true, firstPaymentDone: true, step: 'completed' })
    })
})

describe('resolveOnboarding — what completes the checklist', () => {
    const funded = { identityStatus: 'verified' as const, milestone: 'funded' as const, holdsMoney: true }

    it.each(['card_qr', 'card', 'qr'] as const)('%s: only the API activation completes the payment row', (route) => {
        expect(resolve({ ...funded, firstPaymentRoute: route }).step).toBe('first_payment')
        expect(resolve({ ...funded, firstPaymentRoute: route, isActivated: true }).step).toBe('completed')
    })

    it('none (no card, no QR): no payment row, complete once verified and funded', () => {
        expect(resolve({ ...funded, firstPaymentRoute: 'none' })).toMatchObject({
            firstPaymentDone: false,
            step: 'completed',
        })
    })

    it('pending (card eligibility loading or failed): the row holds its place, never complete', () => {
        expect(resolve({ ...funded, firstPaymentRoute: 'pending' })).toMatchObject({
            firstPaymentDone: false,
            step: 'first_payment',
        })
    })

    it('none: not complete while the ID check is open or in review, or before money arrives', () => {
        expect(resolve({ milestone: 'funded', holdsMoney: true, firstPaymentRoute: 'none' }).step).toBe('verify')
        expect(
            resolve({ identityStatus: 'processing', milestone: 'funded', holdsMoney: true, firstPaymentRoute: 'none' })
                .step
        ).toBe('verify')
        expect(resolve({ identityStatus: 'verified', firstPaymentRoute: 'none' }).step).toBe('add_money')
    })
})

describe('selectFirstPaymentRoute — the one eligibility selector', () => {
    it('card and QR → card_qr', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: true, canPayQr: true })).toBe('card_qr')
    })

    it('card only → card', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: true, canPayQr: false })).toBe('card')
    })

    it('QR only → qr', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: false, canPayQr: true })).toBe('qr')
    })

    it('neither → none', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: false, canPayQr: false })).toBe('none')
    })

    it('card eligibility unknown (loading or failed) → pending, whatever the QR answer', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: undefined, canPayQr: true })).toBe('pending')
        expect(selectFirstPaymentRoute({ canSpendViaCard: undefined, canPayQr: false })).toBe('pending')
    })

    it('the QR gate still loading → pending, whatever the card answer', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: true, canPayQr: undefined })).toBe('pending')
        expect(selectFirstPaymentRoute({ canSpendViaCard: false, canPayQr: undefined })).toBe('pending')
    })
})

describe('canHideChecklist — only once the payment row is the one left', () => {
    const funded = { identityStatus: 'verified' as const, milestone: 'funded' as const, holdsMoney: true }

    it('verified and funded, payment open → can hide', () => {
        expect(canHideChecklist(resolve(funded))).toBe(true)
    })

    it('not before Add money is done, and not before the ID check is done', () => {
        expect(canHideChecklist(resolve({ identityStatus: 'verified', milestone: 'verified' }))).toBe(false)
        expect(canHideChecklist(resolve({ milestone: 'funded', holdsMoney: true }))).toBe(false)
        expect(canHideChecklist(resolve({ identityStatus: 'processing', milestone: 'funded' }))).toBe(false)
    })

    it('not when there is nothing left to hide', () => {
        expect(canHideChecklist(resolve({ ...funded, isActivated: true }))).toBe(false)
        expect(canHideChecklist(resolve({ ...funded, firstPaymentRoute: 'none' }))).toBe(false)
        expect(canHideChecklist(resolve({ ...funded, firstPaymentRoute: 'pending' }))).toBe(false)
    })
})
