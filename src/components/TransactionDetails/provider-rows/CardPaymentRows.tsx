'use client'

import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { friendlyDeclineReason } from '@/utils/cardDeclineReason'

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

/** Whether the transaction's local-currency block represents a real cross-
 *  currency charge that should be surfaced to the user. Normalizes the
 *  currency string and skips USD (the display currency). */
function hasCrossCurrencyCharge(card: NonNullable<TransactionDetails['extraDataForDrawer']>['cardPayment']): boolean {
    if (!card) return false
    const currency = nonBlank(card.localCurrency)
    if (!currency) return false
    if (currency.toLowerCase() === 'usd') return false
    return parseCents(card.localAmount) != null
}

/**
 * Whether CardPaymentRows would render any visible sub-row for this
 * transaction. The row-config in the receipt uses this to gate the
 * `cardPayment` slot — without it, we'd end up with a "visible" but
 * empty slot, which throws off `shouldHideBorder` and dangles the
 * preceding row's border into empty space.
 */
export function hasCardPaymentRowsContent(transaction: TransactionDetails): boolean {
    const card = transaction.extraDataForDrawer?.cardPayment
    if (!card) return false

    if (nonBlank(card.merchantCategory)) return true
    if (nonBlank(card.merchantCity) || nonBlank(card.merchantCountry)) return true
    if (hasCrossCurrencyCharge(card)) return true
    if (card.settlementAdjusted && parseCents(card.authAmount) != null) return true
    if (transaction.status === 'failed' && card.declineReason) return true
    if (card.cancellationReason === 'auto_closed') return true
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
    const subRows: { label: string; value: string; key: string }[] = []

    const categoryClean = nonBlank(card.merchantCategory)
    if (categoryClean) {
        subRows.push({ key: 'category', label: 'Category', value: categoryClean })
    }

    const cityClean = nonBlank(card.merchantCity)
    const countryClean = nonBlank(card.merchantCountry)
    if (cityClean || countryClean) {
        subRows.push({
            key: 'location',
            label: 'Location',
            value: [cityClean, countryClean].filter(Boolean).join(', '),
        })
    }

    // Cross-currency only — suppress when the local currency matches the USD
    // display currency (everyone's seen "Charged in 150 usd" alongside $1.50
    // and it's just noise). Normalized + NaN-guarded to avoid stray junk
    // making it past the rendering predicate.
    if (hasCrossCurrencyCharge(card)) {
        const localCents = parseCents(card.localAmount)!
        const currency = nonBlank(card.localCurrency)!.toUpperCase()
        subRows.push({
            key: 'chargedIn',
            label: 'Charged in',
            value: `${(localCents / 100).toFixed(2)} ${currency}`,
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

    // Spec §4.4 — show why a card spend declined.
    if (transaction.status === 'failed' && card.declineReason) {
        subRows.push({
            key: 'declineReason',
            label: 'Decline reason',
            value: friendlyDeclineReason(card.declineReason),
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
