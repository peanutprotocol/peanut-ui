/**
 * Receipt-side type predicates. Centralises every kind/provider check so
 * adding a flow is one line in one place rather than a grep-and-edit
 * across the receipt.
 *
 * Predicates take `TransactionDetails` (the drawer view model) — not raw
 * `HistoryEntry` — because some require fields that only exist after the
 * transformer runs (e.g. `extraDataForDrawer.cardPayment`).
 */

import { isAddress } from 'viem'
import { type TransactionDetails } from './transactionTransformer'
import type { IntentKind } from './strategies/registry'

function kindOf(transaction: TransactionDetails): string | undefined {
    return transaction.extraDataForDrawer?.kind
}

function isKind(transaction: TransactionDetails, kind: IntentKind): boolean {
    return kindOf(transaction) === kind
}

export function isQRPayment(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'QR_PAY')
}

/** A Rain card *spend* (not a refund or reversal). Kind-based so refunds
 *  (REFUND/OTHER) and auth reversals are excluded. Card-spend eligibility for
 *  the "Split this bill" CTA layers a settled-status check on top — see
 *  {@link isSplittable}. */
export function isCardSpend(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'CARD_SPEND_AUTH') || isKind(transaction, 'CARD_SPEND_CLEAR')
}

/** Eligible for the "Split this bill" CTA: a QR payment, or a card spend that
 *  actually went through. This is an in-the-moment action right after paying,
 *  so a freshly-authorized card hold (`pending`) IS splittable — settlement can
 *  take days and we don't make users wait. The only card spends excluded are the
 *  ones that didn't stick: refunded, failed, and `cancelled` (the auth was
 *  reversed or expired — "Hold released, funds back on your card"). QR pays keep
 *  their prior behaviour (splittable unless refunded/failed). */
export function isSplittable(transaction: TransactionDetails): boolean {
    if (transaction.status === 'refunded' || transaction.status === 'failed') return false
    if (isQRPayment(transaction)) return true
    if (isCardSpend(transaction)) return transaction.status !== 'cancelled'
    return false
}

/** Kinds that move money across a fiat rail: bank on/off-ramps + QR pays.
 *  The single anchor for the receipt-page whitelist (`getReceiptUrl`), the
 *  share gate (`hasShareableReceipt`), and the FX predicate
 *  (`isFxBearingFlow`) — previously three hand-kept copies of this set. */
export const FIAT_RAIL_KINDS: ReadonlySet<string> = new Set(['QR_PAY', 'ONRAMP', 'OFFRAMP'])

// Shareable receipts: QR payments + bank on/off-ramps. Kept as its own
// predicate so "shareable" can diverge from "fiat rail" later without a sweep.
export function hasShareableReceipt(transaction: TransactionDetails): boolean {
    const k = kindOf(transaction)
    return !!k && FIAT_RAIL_KINDS.has(k)
}

// Renders "Completed" label for the timestamp row instead of "Sent"/"Received".
// One-shot bank/onchain flows.
export function usesCompletedTimestampLabel(transaction: TransactionDetails): boolean {
    const k = kindOf(transaction)
    return k === 'ONRAMP' || k === 'OFFRAMP' || k === 'CRYPTO_WITHDRAW' || k === 'CRYPTO_DEPOSIT'
}

/** True for any Rain card-spend or card-refund entry. The transformer fills
 *  `extraDataForDrawer.cardPayment` for both — that's the discriminator. */
export function isCardPaymentEntry(transaction: TransactionDetails): boolean {
    return transaction.extraDataForDrawer?.cardPayment != null
}

/** Flows that cross fiat ↔ USD and therefore carry an FX rate worth showing:
 *  bank on/off-ramps, QR pays, and Rain card spends + refunds. Gating the
 *  exchange-rate row on this (rather than a hand-kept `direction` allow-list)
 *  is what stops the "forgot to add the new direction" bug class — card
 *  refunds arrive as `direction: 'receive'` and were silently missed before.
 *  The currency-block / non-stablecoin / not-cancelled checks still apply on
 *  top; this only answers "is this the kind of flow that has an FX rate".
 *
 *  The card arm MUST stay `isCardPaymentEntry` (block-based), not a kind
 *  check: card refunds can arrive with kind `OTHER`/`REFUND` (legacy rows the
 *  fallback routes to cardRefund via `parentRainTxId`), so a pure-kind
 *  "simplification" would silently drop their FX rate again. */
export function isFxBearingFlow(transaction: TransactionDetails): boolean {
    const k = kindOf(transaction)
    return (!!k && FIAT_RAIL_KINDS.has(k)) || isCardPaymentEntry(transaction)
}

export function isPerkReward(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'PERK_REWARD')
}

// SEND_LINK kind covers the entire link lifecycle: created, claimed,
// reclaimed-by-self. Receipt CTAs (QR, Share, Cancel) gate on this.
export function isSendLinkEntry(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'SEND_LINK')
}

// Request-pot rollups arrive as P2P_REQUEST_FULFILL + isRequestPotRollup
// flag; individual request payments arrive as plain P2P_REQUEST_FULFILL.
// Both gate the request-shaped UI.
export function isRequestEntry(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'P2P_REQUEST_FULFILL')
}

// Wallet-to-wallet direct send.
export function isDirectSendEntry(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'DIRECT_TRANSFER')
}

// Any bank-rail deposit (Bridge or Manteca).
export function isOnrampEntry(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'ONRAMP')
}

// Manteca-flavoured onramp specifically (renders the ARS/BRL deposit-info
// row). Bridge + Manteca share the ONRAMP kind, so provider is the
// positive-identity discriminator.
export function isMantecaOnrampEntry(transaction: TransactionDetails): boolean {
    return isKind(transaction, 'ONRAMP') && transaction.extraDataForDrawer?.provider === 'MANTECA'
}

// The counterparty is a real Peanut user whose profile we can deep-link to:
// a non-link send / request / receive whose identifier is a username (not a
// raw 0x address, which has no Peanut profile). The single source of truth for
// the clickable name + avatar in both the history row (TransactionCard) and the
// receipt header (TransactionDetailsHeaderCard) — keep the eligibility rule here
// so the two surfaces can't drift.
export function canNavigateToUserProfile(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.transactionCardType
    return (
        !transaction.extraDataForDrawer?.isLinkTransaction &&
        !!transaction.userName &&
        !isAddress(transaction.userName) &&
        (type === 'send' || type === 'request' || type === 'receive')
    )
}
