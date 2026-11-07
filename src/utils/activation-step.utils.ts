import {
    verifyRowStatus as canonicalVerifyRowStatus,
    resolveOnboarding as canonicalResolveOnboarding,
} from '@/features/attention/onboarding.generated'
import { type User } from '@/interfaces/interfaces'
import type { IdentityVerificationStatus, RailCapability } from '@/types/capabilities'
import { computeAvailableSpendable } from '@/utils/balance.utils'

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
 * True when the account holds any money: wallet USDC or card collateral. Any
 * amount counts — $0.17 sent by crypto is as much "added money" as a bank
 * top-up.
 *
 * `walletBalance` is USDC base units (bigint from useWallet).
 */
export function holdsMoney(
    walletBalance: bigint | string | number | null | undefined,
    cardBalance: { spendingPower?: number | null } | null | undefined
): boolean {
    if (walletBalance != null && Number(walletBalance) > 0) return true
    return computeAvailableSpendable(0n, cardBalance?.spendingPower) > 0n
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

/**
 * The to-do list's count: create account (always done), verify, add money, and
 * first payment when a spend route exists (a pending route is an open row).
 */
export function checklistProgress(onboarding: OnboardingState): { done: number; total: number } {
    const hasPaymentRow = onboarding.firstPaymentRoute !== 'none'
    const done =
        1 +
        (onboarding.verify === 'done' ? 1 : 0) +
        (onboarding.addMoneyDone ? 1 : 0) +
        (hasPaymentRow && onboarding.firstPaymentDone ? 1 : 0)
    return { done, total: hasPaymentRow ? 4 : 3 }
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
    return canonicalVerifyRowStatus(input)
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
    return canonicalResolveOnboarding(input)
}
