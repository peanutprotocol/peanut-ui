import { type User } from '@/interfaces/interfaces'
import type { IdentityVerificationStatus, RailCapability } from '@/types/capabilities'
import { computeDisplaySpendable } from '@/utils/balance.utils'

/**
 * The Home onboarding checklist (TASK-23054, Hugo 2026-09-25):
 * Create account ✓ · Verify identity · Add money · First payment.
 * Home shows it until the first payment is done, then the carousel. A user
 * with no activating spend (no card, no QR rail) has no payment row: their
 * list ends at Add money, and Home hands over once it is all done.
 *
 * `ActivationStep` is the first row that is still open and actionable, or
 * `completed`. It is what PostHog `activation_step_viewed` reports.
 */
export type ActivationStep = 'verify' | 'add_money' | 'first_payment' | 'completed'

/**
 * Verify identity row:
 * - `todo`: never started; the tap starts the ID check
 * - `in_review`: open, nothing for the user to do
 * - `action_required`: the check needs something from the user (a new photo,
 *   an email collision); the tap opens the identity status with its fix
 * - `failed`: a final decision. The row cannot finish, so Home shows the
 *   blocked card with contact support instead of the checklist
 * - `done`: verified, or already moving money on an enabled rail
 */
export type VerifyRowStatus = 'todo' | 'in_review' | 'action_required' | 'failed' | 'done'

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
    /** a card is issued or its application is in; the card copy says "pay with", not "get" */
    cardHeld?: boolean
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

/**
 * A user who can already move money: any enabled rail (bank, QR or an active
 * card), or the API says they activated. Home stops treating them as mid-setup:
 * their Verify row counts as done and a rejected extra rail is not a blocker.
 * Legacy users verified by a bank partner before the one ID check have enabled
 * rails and no approved ID check.
 */
export function canAlreadyTransact(rails: readonly RailCapability[], isActivated: boolean): boolean {
    return isActivated || rails.some((rail) => rail.status === 'enabled')
}

export interface VerifyRowInput {
    status: IdentityVerificationStatus | undefined
    /** useIdentityVerification: a final decision (not region), incl. a FINAL action_required */
    isTerminalFailure?: boolean
    /** useIdentityVerification: the document's country is refused */
    isRegionRestricted?: boolean
    /** canAlreadyTransact: the user already moves money on an enabled rail */
    canTransact?: boolean
}

export function verifyRowStatus(input: VerifyRowInput): VerifyRowStatus {
    if (input.status === 'verified' || input.canTransact) return 'done'
    if (input.status === 'processing') return 'in_review'
    if (input.isTerminalFailure || input.isRegionRestricted) return 'failed'
    // a retryable failure (the check itself errored) has a fix, like action_required
    if (input.status === 'action_required' || input.status === 'failed') return 'action_required'
    return 'todo'
}

export interface OnboardingInput {
    identity: VerifyRowInput
    milestone: User['activationMilestone'] | null | undefined
    /** API: first card spend or QR pay (Lexicon v2 activation) */
    isActivated: boolean
    holdsMoney: boolean
    firstPaymentRoute: FirstPaymentRoute
    cardHeld: boolean
}

export function resolveOnboarding(input: OnboardingInput): OnboardingState {
    const verify = verifyRowStatus(input.identity)
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
    // a failed check stays on `verify`: Home shows the blocked card, not the list
    else if (verify === 'todo' || verify === 'action_required' || verify === 'failed') step = 'verify'
    else if (!addMoneyDone) step = 'add_money'
    else if (hasPaymentRow) step = 'first_payment'
    // no payment row: the list ends at Add money, done once identity is too
    // (an ID check in review is the one open row left)
    else step = verify === 'done' ? 'completed' : 'verify'

    return {
        verify,
        addMoneyDone,
        firstPaymentDone,
        firstPaymentRoute: input.firstPaymentRoute,
        cardHeld: input.cardHeld,
        step,
    }
}

/**
 * The checklist can be hidden once only the payment row is left (Create,
 * Verify and Add money done) and known. It covers users who only move money
 * in and out, who would otherwise keep a 75% list forever.
 */
export function canHideChecklist(state: OnboardingState): boolean {
    // not while the payment row itself is still loading
    return (
        state.verify === 'done' &&
        state.addMoneyDone &&
        state.step === 'first_payment' &&
        state.firstPaymentRoute !== 'pending'
    )
}
