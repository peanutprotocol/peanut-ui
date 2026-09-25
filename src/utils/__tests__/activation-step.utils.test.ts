/**
 * The Home activation funnel rule: verify → add money → spend.
 *
 * "Add money" is done when the API milestone says funded OR the account holds
 * any money (wallet or card collateral). A raw on-chain transfer leaves no
 * ledger credit, so the milestone lags at verified while the money is real
 * (TASK-23054: a user with $0.17 from crypto was still told to add money).
 */
import { holdsMoney, resolveActivationStep, type ActivationStepInput } from '@/utils/activation-step.utils'

const USDC = (usd: number) => BigInt(Math.round(usd * 1e6))

const base: ActivationStepInput = {
    isActivated: false,
    milestone: 'verified',
    isKycApproved: true,
    holdsMoney: false,
    canApplyForCard: false,
    hasActiveCard: false,
    cardDismissed: false,
    cardPromotionDisabled: false,
}
const resolve = (overrides: Partial<ActivationStepInput>) => resolveActivationStep({ ...base, ...overrides })

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

describe('resolveActivationStep', () => {
    it('verified with $0 → add money (deposit), not funded', () => {
        expect(resolve({})).toEqual({ step: 'deposit', isFunded: false })
    })

    it('not verified with $0 → verify', () => {
        expect(resolve({ milestone: 'registered', isKycApproved: false })).toEqual({ step: 'verify', isFunded: false })
    })

    it('$0.17 by crypto (milestone still verified) → funded, spend step', () => {
        expect(resolve({ holdsMoney: holdsMoney(USDC(0.17), null) })).toEqual({ step: 'outbound', isFunded: true })
    })

    it('money before the ID check → funded, like the API (funded outranks verified)', () => {
        expect(resolve({ milestone: 'registered', isKycApproved: false, holdsMoney: true })).toEqual({
            step: 'outbound',
            isFunded: true,
        })
    })

    it('bank top-up (milestone funded) → funded even after the balance is moved out', () => {
        expect(resolve({ milestone: 'funded', holdsMoney: false })).toEqual({ step: 'outbound', isFunded: true })
    })

    it('received P2P payment (a posted credit, milestone funded) → funded', () => {
        expect(resolve({ milestone: 'funded', holdsMoney: true })).toEqual({ step: 'outbound', isFunded: true })
    })

    it('card collateral only (wallet 0, milestone verified) → funded', () => {
        const money = holdsMoney(0n, { spendingPower: 2500, inTransitToCollateralCents: 0 })
        expect(resolve({ holdsMoney: money, hasActiveCard: true, canApplyForCard: true })).toEqual({
            step: 'outbound',
            isFunded: true,
        })
    })

    it('spent (activated) → completed', () => {
        expect(resolve({ isActivated: true, milestone: 'activated', holdsMoney: true })).toEqual({
            step: 'completed',
            isFunded: true,
        })
    })

    it('a response without a milestone falls back to KYC + money', () => {
        expect(resolve({ milestone: undefined, isKycApproved: true })).toEqual({ step: 'deposit', isFunded: false })
        expect(resolve({ milestone: undefined, isKycApproved: false })).toEqual({ step: 'verify', isFunded: false })
        expect(resolve({ milestone: undefined, holdsMoney: true })).toEqual({ step: 'outbound', isFunded: true })
    })

    describe('card step replaces the spend step only once funded', () => {
        it('card-eligible with $0 → still add money', () => {
            expect(resolve({ canApplyForCard: true }).step).toBe('deposit')
        })

        it('card-eligible with $0.17 → card', () => {
            expect(resolve({ canApplyForCard: true, holdsMoney: true })).toEqual({ step: 'card', isFunded: true })
        })

        it('not after "Maybe later", not with an active card, not with the kill switch', () => {
            const funded = { canApplyForCard: true, holdsMoney: true }
            expect(resolve({ ...funded, cardDismissed: true }).step).toBe('outbound')
            expect(resolve({ ...funded, hasActiveCard: true }).step).toBe('outbound')
            expect(resolve({ ...funded, cardPromotionDisabled: true }).step).toBe('outbound')
        })
    })
})
