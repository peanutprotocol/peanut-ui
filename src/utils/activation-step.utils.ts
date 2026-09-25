import { type User } from '@/interfaces/interfaces'
import type { IdentityVerificationStatus, RailCapability } from '@/types/capabilities'
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
 * Which activating spend is open to the user: the card (it can be issued or is
 * held), a QR pay rail (Pix / Mercado Pago), both, or neither. The
 * first-payment row's presence, copy and tap all follow this one answer. A
 * send is never one: it does not activate.
 */
export type FirstPaymentRoute = 'card_qr' | 'card' | 'qr' | 'none'

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
 * A Manteca rail that can pay a merchant QR (Pix or Mercado Pago).
 *
 * Keyed on the provider and the `pay` op, never on the channel: Pix is a
 * BANK-channel method that happens to carry `pay` (peanut-api-ts
 * METHOD_CHANNELS — MercadoPago is the only `qr-only` entry), and the QR pool
 * enables its rails one at a time, so a `qr-only` filter silently drops every
 * Brazilian user whose Pix pays but whose MercadoPago row did not enable.
 *
 * `pay` must be present AND enabled — deliberately not `canDo`/`operationStatus`,
 * whose `operations.pay ?? status` fallback would read a bank-only rail's
 * missing `pay` as the rail's enabled status. MANTECA_METHOD_OPERATIONS lists
 * every op a method supports (BANK_TRANSFER_AR is deposit+withdraw only), so on
 * a rail that carries the map an absent `pay` means "no merchant QR". The map
 * is only absent for an unknown method or an older response, where the qr-only
 * channel is pay by construction.
 */
export function hasQrPayRail(
    rails: RailCapability[],
    channelOf: (rail: RailCapability) => string | undefined
): boolean {
    return rails.some((rail) => {
        if (rail.provider !== 'manteca') return false
        if (rail.operations) return rail.operations.pay === 'enabled'
        return channelOf(rail) === 'qr-only' && rail.status === 'enabled'
    })
}

/** The one eligibility selector behind the first-payment row. */
export function selectFirstPaymentRoute(input: { canSpendViaCard: boolean; hasQrRail: boolean }): FirstPaymentRoute {
    if (input.canSpendViaCard) return input.hasQrRail ? 'card_qr' : 'card'
    return input.hasQrRail ? 'qr' : 'none'
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
    /**
     * False while card eligibility is still loading and no QR rail decides the
     * route: `none` may yet become `card`, so the list must not complete on it.
     */
    isRouteSettled: boolean
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
    else if (hasPaymentRow || !input.isRouteSettled) step = 'first_payment'
    // no payment row: the list ends at Add money, done once identity is too
    // (an ID check in review is the one open row left)
    else step = verify === 'done' ? 'completed' : 'verify'

    return { verify, addMoneyDone, firstPaymentDone, firstPaymentRoute: input.firstPaymentRoute, step }
}
