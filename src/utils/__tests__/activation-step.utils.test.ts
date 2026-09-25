/**
 * The Home onboarding checklist rules (TASK-23054):
 * Create account ✓ · Verify identity · Add money · Make the first payment.
 *
 * "Add money" is done on any money received or held (wallet or card
 * collateral) — $0.17 by crypto counts. "Make the first payment" is done only
 * on the API activation (card spend or QR pay), and exists only for a user who
 * can make one; a user with neither card nor QR has three rows.
 */
import type { RailCapability } from '@/types/capabilities'
import {
    type OnboardingInput,
    hasQrPayRail,
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

    it('none: not complete while the ID check is open or in review, or before money arrives', () => {
        expect(resolve({ milestone: 'funded', holdsMoney: true, firstPaymentRoute: 'none' }).step).toBe('verify')
        expect(
            resolve({ identityStatus: 'processing', milestone: 'funded', holdsMoney: true, firstPaymentRoute: 'none' })
                .step
        ).toBe('verify')
        expect(resolve({ identityStatus: 'verified', firstPaymentRoute: 'none' }).step).toBe('add_money')
    })
})

describe('selectFirstPaymentRoute — the one eligibility selector, all four cases', () => {
    it('card and QR → card_qr', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: true, hasQrRail: true })).toBe('card_qr')
    })

    it('card only → card', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: true, hasQrRail: false })).toBe('card')
    })

    it('QR only → qr', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: false, hasQrRail: true })).toBe('qr')
    })

    it('neither → none', () => {
        expect(selectFirstPaymentRoute({ canSpendViaCard: false, hasQrRail: false })).toBe('none')
    })
})

describe('hasQrPayRail', () => {
    const channelOf = (rail: RailCapability) => rail.channel
    const rail = (overrides: Partial<RailCapability>) =>
        ({
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
            ...overrides,
        }) as RailCapability

    it('a Pix rail whose pay op is enabled (bank channel) pays QRs', () => {
        expect(hasQrPayRail([rail({ operations: { pay: 'enabled', deposit: 'requires-info' } })], channelOf)).toBe(true)
    })

    it('an enabled MercadoPago qr-only rail pays QRs', () => {
        expect(
            hasQrPayRail(
                [rail({ id: 'manteca.mercadopago_qr_ar', channel: 'qr-only', operations: { pay: 'enabled' } })],
                channelOf
            )
        ).toBe(true)
    })

    it('a bank-only Manteca rail (no pay op) does not, even though it is enabled', () => {
        expect(
            hasQrPayRail(
                [rail({ id: 'manteca.bank_transfer_ar', operations: { deposit: 'enabled', withdraw: 'enabled' } })],
                channelOf
            )
        ).toBe(false)
    })

    it('a pay op that is not enabled does not', () => {
        expect(hasQrPayRail([rail({ operations: { pay: 'requires-info' } })], channelOf)).toBe(false)
    })

    it('a non-Manteca rail never does', () => {
        expect(hasQrPayRail([rail({ provider: 'bridge', operations: { pay: 'enabled' } })], channelOf)).toBe(false)
    })
})
