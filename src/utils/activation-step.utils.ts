import { type User } from '@/interfaces/interfaces'
import type { IdentityVerificationStatus } from '@/types/capabilities'
import { computeDisplaySpendable } from '@/utils/balance.utils'

/**
 * The Home onboarding checklist (TASK-23054, Hugo 2026-09-25):
 * Create account ✓ · Verify identity · Add money · Make the first payment.
 * Home shows it until the first payment is done, then the carousel. A user
 * with no activating spend (no card, no QR rail) has no payment row: their
 * list ends at Add money, and Home hands over once it is all done.
 *
 * `ActivationStep` is the first row that is still open and actionable, or
 * `completed`. It is what PostHog `activation_step_viewed` reports.
 */
export type ActivationStep = 'verify' | 'add_money' | 'first_payment' | 'completed'

/** Verify identity row: `in_review` is open but has nothing for the user to do. */
export type VerifyRowStatus = 'todo' | 'in_review' | 'done'

/**
 * Which activating spend is open to the user: the card (it can be issued or
 * is held), a QR pay (the QR-pay KYC gate says it is a path: now, or once
 * verified or fixed), both, or neither. `pending` while either answer is
 * unknown (loading, or failed card info): the row holds its place and the
 * list cannot complete. The first-payment row's presence, copy and tap all follow this
 * one answer. A send is never one: it does not activate.
 */
export type FirstPaymentRoute = 'card_qr' | 'card' | 'qr' | 'none' | 'pending'

export interface OnboardingState {
    verify: VerifyRowStatus
    addMoneyDone: boolean
    firstPaymentDone: boolean
    firstPaymentRoute: FirstPaymentRoute
    /** first open, actionable row; `completed` once every row is done */
    step: ActivationStep
}

/**
 * True when the account holds any money: wallet USDC, card collateral, or a
 * collateral top-up still in transit. Any amount counts — $0.17 sent by crypto
 * is as much "added money" as a bank top-up.
 *
 * `walletBalance` is USDC base units (bigint from useWallet).
 */
export function holdsMoney(
    walletBalance: bigint | string | number | null | undefined,
    cardBalance: { spendingPower?: number | null; inTransitToCollateralCents?: number | null } | null | undefined
): boolean {
    if (walletBalance != null && Number(walletBalance) > 0) return true
    return computeDisplaySpendable(0n, cardBalance?.spendingPower, cardBalance?.inTransitToCollateralCents) > 0n
}

/**
 * The one eligibility selector behind the first-payment row.
 * Undefined on either side = not known yet: the route is `pending`.
 */
export function selectFirstPaymentRoute(input: {
    canSpendViaCard: boolean | undefined
    /** from the QR-pay KYC gate (qrPayIsAPath); undefined while it loads */
    canPayQr: boolean | undefined
}): FirstPaymentRoute {
    if (input.canSpendViaCard === undefined || input.canPayQr === undefined) return 'pending'
    if (input.canSpendViaCard) return input.canPayQr ? 'card_qr' : 'card'
    return input.canPayQr ? 'qr' : 'none'
}

export function verifyRowStatus(identityStatus: IdentityVerificationStatus | undefined): VerifyRowStatus {
    if (identityStatus === 'verified') return 'done'
    if (identityStatus === 'processing') return 'in_review'
    return 'todo'
}

export interface OnboardingInput {
    identityStatus: IdentityVerificationStatus | undefined
    milestone: User['activationMilestone'] | null | undefined
    /** API: first card spend or QR pay (Lexicon v2 activation) */
    isActivated: boolean
    holdsMoney: boolean
    firstPaymentRoute: FirstPaymentRoute
}

export function resolveOnboarding(input: OnboardingInput): OnboardingState {
    const verify = verifyRowStatus(input.identityStatus)
    // "Add money" is done on any money received (the API milestone needs a
    // posted money-in credit) or on any money held right now — a raw transfer
    // the ledger has not booked yet, or card collateral.
    const addMoneyDone =
        input.isActivated || input.milestone === 'funded' || input.milestone === 'activated' || input.holdsMoney
    // Only the spend that activates (card or QR) completes the payment row.
    const firstPaymentDone = input.isActivated

    const hasPaymentRow = input.firstPaymentRoute !== 'none'
    let step: ActivationStep
    if (firstPaymentDone) step = 'completed'
    else if (verify === 'todo') step = 'verify'
    else if (!addMoneyDone) step = 'add_money'
    else if (hasPaymentRow) step = 'first_payment'
    // no payment row: the list ends at Add money, done once identity is too
    // (an ID check in review is the one open row left)
    else step = verify === 'done' ? 'completed' : 'verify'

    return { verify, addMoneyDone, firstPaymentDone, firstPaymentRoute: input.firstPaymentRoute, step }
}
