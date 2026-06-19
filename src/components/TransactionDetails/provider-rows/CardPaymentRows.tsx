'use client'

import Image from 'next/image'
import { type ReactNode } from 'react'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type DisputeStatus, type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { friendlyDeclineReason } from '@/utils/cardDeclineReason'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { extractMerchantIso2 } from '@/components/TransactionDetails/transaction-details.utils'

/** Strings from Rain's sandbox arrive whitespace-padded ("  ", " - ") and
 *  legacy intents in the DB pre-date the backend cleanField pass — treat any
 *  whitespace-only or placeholder-shaped value as absent. */
function nonBlank(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    if (/^[-_]{1,3}$/.test(trimmed)) return null
    return trimmed
}

/** Parse a cents amount and reject NaN / Infinity / null up-front so the
 *  drawer never renders "Charged in NaN EUR". */
function parseCents(value: string | null | undefined): number | null {
    if (value == null) return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
}

/**
 * Friendly copy for the dispute status row. The drawer shows ONE row labeled
 * "Dispute" with the status-mapped text. Keep terminal-state copy actionable:
 * "Resolved by merchant refund" / "Accepted (refund issued)" both signal that
 * money has been returned (or is being returned), which is the user's actual
 * concern at that point.
 */
export function disputeStatusLabel(status: DisputeStatus): string {
    switch (status) {
        case 'pending':
            return 'Disputed — Awaiting review'
        case 'inReview':
            return 'Disputed — In review'
        case 'accepted':
            return 'Disputed — Accepted (refund issued)'
        case 'rejected':
            return 'Disputed — Rejected'
        case 'canceled':
            return 'Disputed — Cancelled'
        case 'resolvedByMerchant':
            return 'Disputed — Resolved by merchant refund'
    }
}

/**
 * Whether CardPaymentRows would render any visible sub-row for this
 * transaction. The row-config in the receipt uses this to gate the
 * `cardPayment` slot — without it, we'd end up with a "visible" but
 * empty slot, which throws off `shouldHideBorder` and dangles the
 * preceding row's border into empty space.
 *
 * Note: cross-currency `Charged in` USED to live here, but the local
 * fiat amount now flows through the receipt's heading (≈ ARS X) and
 * exchange-rate row instead — same treatment as Manteca QR pays.
 */
/**
 * KEEP IN SYNC with `CardPaymentRows` below — every condition that pushes
 * a sub-row in the renderer needs a matching predicate here. The parent
 * receipt uses this to decide whether to show the slot at all, so a
 * missed condition here means a row exists but its border gets clipped.
 * (No automated check today; verify by inspection when adding rows.)
 */
export function hasCardPaymentRowsContent(transaction: TransactionDetails): boolean {
    const card = transaction.extraDataForDrawer?.cardPayment
    if (!card) return false

    if (extractMerchantIso2(card.merchantCountry)) return true
    if (card.settlementAdjusted && parseCents(card.authAmount) != null) return true
    // declineCategory is BE-controlled (one of 3 enum literals) — no
    // whitespace risk. declineReason is Rain's free-form prose — gate it
    // through nonBlank.
    if (transaction.status === 'failed' && (nonBlank(card.declineReason) || card.declineCategory)) return true
    if (card.cancellationReason === 'auto_closed') return true
    // Hold-release explanation: Rain auths now sit at AWAITING_SETTLEMENT
    // (PENDING badge on the FE) until they settle or release. Both the
    // pending and cancelled states need a row in the receipt — pending so
    // the user understands the money isn't fully spent yet, cancelled so
    // they know why the hold released without a charge.
    if (transaction.status === 'pending' && !card.isRefund) return true
    if (card.cancellationReason === 'auth_reversed' || card.cancellationReason === 'auth_expired_uncaptured') {
        return true
    }
    if (card.dispute) return true
    return false
}

/**
 * Card-payment rows for the receipt's details Card.
 *
 * Slots into the row sequence between `txId` and `fee` via the
 * `cardPayment` rowVisibilityConfig key. Each sub-row is internally
 * gated on data presence so this component renders nothing when the
 * data is fully absent (which itself shouldn't happen — the parent's
 * row config should already gate the slot in that case).
 *
 * Source data: `transaction.extraDataForDrawer.cardPayment`, populated
 * in transactionTransformer for any Rain CARD_SPEND or card-refund
 * entry. Backend mirror: src/transaction-intent/history.ts.
 */
export function CardPaymentRows({
    transaction,
    isLastRow,
}: {
    transaction: TransactionDetails
    /** When true, suppresses bottom border on the LAST visible sub-row so it
     *  meets the Card's edge cleanly. The parent receipt computes this via
     *  `shouldHideBorder('cardPayment')`. */
    isLastRow: boolean
}) {
    const card = transaction.extraDataForDrawer?.cardPayment
    if (!card) return null

    // Compose the visible sub-rows in order, then mark the final one as
    // border-suppressed if this whole slot is also the receipt's last.
    const subRows: { label: string; value: ReactNode; key: string }[] = []

    // Merchant category was dropped — the MCC label adds noise without
    // signal for non-finance users ("Eating Places, Restaurants" tells them
    // nothing they don't already know from the merchant name).

    // Location renders ONLY when we can recover a 2-letter country code.
    // Country flag replaces the prior "City, COUNTRY" text — it's denser
    // and recognisable at a glance; the merchant name on the receipt head
    // carries the city information for users who want it.
    const iso2 = extractMerchantIso2(card.merchantCountry)
    if (iso2) {
        subRows.push({
            key: 'location',
            label: 'Location',
            value: (
                <Image
                    src={getFlagUrl(iso2)}
                    alt={`${iso2.toUpperCase()} flag`}
                    width={80}
                    height={80}
                    className="h-5 w-5 rounded-full object-cover object-center shadow-sm"
                    loading="lazy"
                />
            ),
        })
    }

    // Spec §4.6 — settled amount differs from the original auth (overcapture,
    // tip, partial capture). Show the original auth amount as a hint.
    if (card.settlementAdjusted) {
        const authCents = parseCents(card.authAmount)
        if (authCents != null) {
            subRows.push({
                key: 'adjustedFrom',
                label: 'Original amount',
                value: `$${(authCents / 100).toFixed(2)}`,
            })
        }
    }

    // Spec §4.4 — show why a card spend declined. Prefer the BE-computed
    // synthetic category (disambiguates INSUFFICIENT_FUNDS vs limit-too-low);
    // fall back to the raw Rain code for non-financial declines.
    // Pass declineReason through nonBlank so Rain's whitespace-padded
    // placeholders ("  ", " - ") don't sneak into copy and produce a
    // "Transaction declined" row for an intent with no real decline data.
    // declineCategory is BE-controlled (enum literal) — no whitespace risk.
    const declineReasonClean = nonBlank(card.declineReason)
    if (transaction.status === 'failed' && (declineReasonClean || card.declineCategory)) {
        subRows.push({
            key: 'declineReason',
            label: 'Decline reason',
            value: friendlyDeclineReason(declineReasonClean, card.declineCategory),
        })
    }

    // Spec §4.7 — the periodic stale-auth sweep flips long-standing pending
    // auths to cancelled. Distinguish these from merchant-initiated reversals.
    if (card.cancellationReason === 'auto_closed') {
        subRows.push({
            key: 'autoCloseNote',
            label: 'Note',
            value: "Automatically cancelled — the merchant didn't complete it",
        })
    }

    // BE-driven cancellationReason taxonomy from peanut-api-ts auth-lifecycle
    // PR. `auth_reversed` = merchant explicitly dropped the hold;
    // `auth_expired_uncaptured` = Rain emitted completed-with-zero (the
    // 14-day window closed without a capture). Both translate to "funds
    // returned"; different copy so the user knows what to do next (nothing
    // for reversed; contact the merchant if expired-uncaptured was unwanted).
    // `else if` (rather than two independent `if`s) makes the mutual
    // exclusion explicit — guards against a future refactor that might
    // start storing both at once.
    if (card.cancellationReason === 'auth_reversed') {
        subRows.push({
            key: 'authReversedNote',
            label: 'Note',
            value: 'Hold released — the merchant cancelled the authorization. Funds are back on your card.',
        })
    } else if (card.cancellationReason === 'auth_expired_uncaptured') {
        subRows.push({
            key: 'authExpiredNote',
            label: 'Note',
            value: "Hold released — the merchant didn't capture the payment in time. Funds are back on your card.",
        })
    }

    // Pending card spends now sit at AWAITING_SETTLEMENT (PENDING badge)
    // for up to ~14 days while Rain waits for the merchant to capture or
    // release. Without this row, users see "Pending" and worry the money
    // is stuck — exact wording per @jjramirezn on the auth-lifecycle PR.
    // Guarded against any cancellation-note already in place: a
    // transient pending+cancellationReason payload would otherwise render
    // both "Authorized, awaiting..." AND "Hold released..." simultaneously,
    // which is contradictory copy.
    const hasCancellationNote =
        card.cancellationReason === 'auto_closed' ||
        card.cancellationReason === 'auth_reversed' ||
        card.cancellationReason === 'auth_expired_uncaptured'
    // Active disputes flip the pill to pending too (see transactionTransformer),
    // but the dispute row IS the status — the spend already settled, so
    // "Authorized, awaiting settlement" is a lie next to "Disputed — In review".
    const hasActiveDispute = card.dispute?.status === 'pending' || card.dispute?.status === 'inReview'
    if (transaction.status === 'pending' && !card.isRefund && !hasCancellationNote && !hasActiveDispute) {
        subRows.push({
            key: 'pendingNote',
            label: 'Status',
            value: 'Authorized, awaiting settlement or reversal',
        })
    }

    // Dispute lifecycle. One row for the status; an additional row when Rain
    // has requested evidence so the user knows to upload it. Both render
    // regardless of the spend's status — disputes outlive the spend lifecycle.
    if (card.dispute) {
        subRows.push({
            key: 'disputeStatus',
            label: 'Dispute',
            value: disputeStatusLabel(card.dispute.status),
        })
        if (card.dispute.evidenceRequestedMessage) {
            subRows.push({
                key: 'disputeEvidenceRequest',
                label: 'Evidence requested',
                value: card.dispute.evidenceRequestedMessage,
            })
        }
    }

    if (subRows.length === 0) return null

    return (
        <>
            {subRows.map((row, idx) => (
                <PaymentInfoRow
                    key={row.key}
                    label={row.label}
                    value={row.value}
                    hideBottomBorder={isLastRow && idx === subRows.length - 1}
                />
            ))}
        </>
    )
}
