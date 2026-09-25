import { type User } from '@/interfaces/interfaces'
import { computeDisplaySpendable } from '@/utils/balance.utils'

export type ActivationStep = 'verify' | 'deposit' | 'card' | 'outbound' | 'completed'

type ActivationMilestone = NonNullable<User['activationMilestone']>

const MILESTONE_TO_STEP: Record<ActivationMilestone, ActivationStep> = {
    registered: 'verify',
    verified: 'deposit',
    funded: 'outbound',
    activated: 'completed',
}

/**
 * True when the account holds any money: wallet USDC, card collateral, or a
 * collateral top-up still in transit. Any amount counts — $0.17 sent by crypto
 * is as funded as a bank top-up.
 *
 * `walletBalance` is USDC base units (bigint from useWallet; strings in tests).
 */
export function holdsMoney(
    walletBalance: bigint | string | number | null | undefined,
    cardBalance: { spendingPower?: number | null; inTransitToCollateralCents?: number | null } | null | undefined
): boolean {
    if (walletBalance != null && Number(walletBalance) > 0) return true
    return computeDisplaySpendable(0n, cardBalance?.spendingPower, cardBalance?.inTransitToCollateralCents) > 0n
}

export interface ActivationStepInput {
    isActivated: boolean
    /** API `activationMilestone`; absent only on an old or broken response */
    milestone: ActivationMilestone | null | undefined
    /** fallback for a response without a milestone */
    isKycApproved: boolean
    holdsMoney: boolean
    canApplyForCard: boolean
    hasActiveCard: boolean
    cardDismissed: boolean
    cardPromotionDisabled: boolean
}

/**
 * The Home activation funnel: verify → add money → spend.
 *
 * "Funded" (add money done) is the API milestone `funded`, OR any money on the
 * account. The API milestone only counts a posted ledger credit, so a raw
 * on-chain transfer, or an inbound still in the poller, leaves it at
 * `registered`/`verified` while the user holds money. Those users must see the
 * spend step, not "Add money" — same as the API, where funded outranks verified.
 *
 * The card step replaces the spend step only once funded, for a card-eligible
 * user without an active card who has not dismissed it.
 */
export function resolveActivationStep(input: ActivationStepInput): { step: ActivationStep; isFunded: boolean } {
    let step: ActivationStep
    if (input.isActivated) {
        step = 'completed'
    } else if (input.milestone) {
        step = MILESTONE_TO_STEP[input.milestone] ?? 'verify'
    } else {
        step = input.isKycApproved ? 'deposit' : 'verify'
    }

    if ((step === 'verify' || step === 'deposit') && input.holdsMoney) step = 'outbound'

    const isFunded = step === 'outbound' || step === 'completed'

    if (
        isFunded &&
        input.canApplyForCard &&
        !input.hasActiveCard &&
        !input.cardDismissed &&
        !input.cardPromotionDisabled
    ) {
        step = 'card'
    }

    return { step, isFunded }
}
