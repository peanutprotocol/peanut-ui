/**
 * Receipt-side type predicates.
 *
 * Pre-M3 the receipt branched on `originalType === EHistoryEntryType.X` in
 * many places, often as multi-element OR chains (e.g. "is this any kind of
 * QR payment?", "is this any kind of bank flow?"). This module centralises
 * those checks so adding a provider is one line in one place rather than a
 * grep-and-edit across the receipt.
 *
 * Predicates take `TransactionDetails` (the drawer view model) — not raw
 * `HistoryEntry` — because some require fields that only exist after the
 * transformer runs (e.g. `extraDataForDrawer.cardPayment`).
 */

import { type TransactionDetails } from './transactionTransformer'
import { EHistoryEntryType } from '@/hooks/useTransactionHistory'

const QR_PAYMENT_TYPES: ReadonlySet<EHistoryEntryType> = new Set([
    EHistoryEntryType.MANTECA_QR_PAYMENT,
    EHistoryEntryType.SIMPLEFI_QR_PAYMENT,
])

// Types whose receipt is shareable (split-bill prompt + share-receipt button).
// Same as QR-payments today plus Manteca on/off-ramps; kept as its own set so
// "shareable" can diverge from "QR" later without a sweep.
const SHAREABLE_RECEIPT_TYPES: ReadonlySet<EHistoryEntryType> = new Set([
    EHistoryEntryType.MANTECA_QR_PAYMENT,
    EHistoryEntryType.SIMPLEFI_QR_PAYMENT,
    EHistoryEntryType.MANTECA_OFFRAMP,
    EHistoryEntryType.MANTECA_ONRAMP,
])

// Types where the timestamp label reads "Completed" (one-shot bank/onchain
// flows) instead of "Sent"/"Received" (peer-shaped flows).
const COMPLETED_LABEL_TYPES: ReadonlySet<EHistoryEntryType> = new Set([
    EHistoryEntryType.WITHDRAW,
    EHistoryEntryType.DEPOSIT,
    EHistoryEntryType.BRIDGE_OFFRAMP,
    EHistoryEntryType.BRIDGE_ONRAMP,
    EHistoryEntryType.BRIDGE_GUEST_OFFRAMP,
    EHistoryEntryType.BANK_SEND_LINK_CLAIM,
    EHistoryEntryType.MANTECA_OFFRAMP,
    EHistoryEntryType.MANTECA_ONRAMP,
])

export function isQRPayment(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    return type ? QR_PAYMENT_TYPES.has(type) : false
}

export function hasShareableReceipt(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    return type ? SHAREABLE_RECEIPT_TYPES.has(type) : false
}

/** Renders "Completed" label for the timestamp row instead of "Sent"/"Received". */
export function usesCompletedTimestampLabel(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    return type ? COMPLETED_LABEL_TYPES.has(type) : false
}

/** True for any Rain card-spend or card-refund entry. The transformer fills
 *  `extraDataForDrawer.cardPayment` for both — that's the discriminator. */
export function isCardPaymentEntry(transaction: TransactionDetails): boolean {
    return transaction.extraDataForDrawer?.cardPayment != null
}

export function isPerkReward(transaction: TransactionDetails): boolean {
    return transaction.extraDataForDrawer?.originalType === EHistoryEntryType.PERK_REWARD
}
