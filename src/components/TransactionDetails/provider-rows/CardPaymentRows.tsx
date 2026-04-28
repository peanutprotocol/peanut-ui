'use client'

import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { friendlyDeclineReason } from '@/utils/cardDeclineReason'

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

    if (card.merchantCategory) {
        subRows.push({ key: 'category', label: 'Category', value: card.merchantCategory })
    }

    if (card.merchantCity || card.merchantCountry) {
        subRows.push({
            key: 'location',
            label: 'Location',
            value: [card.merchantCity, card.merchantCountry].filter(Boolean).join(', '),
        })
    }

    // Cross-currency only — suppress when the local currency matches the USD
    // display currency (everyone's seen "Charged in 150 usd" alongside $1.50
    // and it's just noise).
    if (
        card.localAmount &&
        card.localCurrency &&
        card.localCurrency.toLowerCase() !== 'usd'
    ) {
        // Local amount comes through as raw cents from Rain — format to a
        // human number with two decimals before showing.
        const localFormatted = (Number(card.localAmount) / 100).toFixed(2)
        subRows.push({
            key: 'chargedIn',
            label: 'Charged in',
            value: `${localFormatted} ${card.localCurrency.toUpperCase()}`,
        })
    }

    // Spec §4.6 — settled amount differs from the original auth (overcapture,
    // tip, partial capture). Show the original auth amount as a hint.
    if (card.settlementAdjusted && card.authAmount) {
        const adjustedFromUsd = (Number(card.authAmount) / 100).toFixed(2)
        subRows.push({
            key: 'adjustedFrom',
            label: 'Original amount',
            value: `$${adjustedFromUsd}`,
        })
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
