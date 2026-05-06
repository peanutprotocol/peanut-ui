/**
 * Receipt-side type predicates. Centralised so adding a provider is a one-line
 * change rather than a grep-and-edit across the receipt.
 *
 * Predicates take `TransactionDetails` (the drawer view model) rather than
 * raw `HistoryEntry` because some need fields the transformer derives
 * (e.g. `extraDataForDrawer.cardPayment`).
 */

import { type TransactionDetails } from './transactionTransformer'
// Type-only import to avoid a jest circular-load cycle through
// utils/history.utils → transactionTransformer → TransactionCard. The Sets
// below use string literals because EHistoryEntryType is a string enum, so
// runtime values match their literal forms.
import type { EHistoryEntryType } from '@/utils/history.utils'

const QR_PAYMENT_TYPES: ReadonlySet<EHistoryEntryType> = new Set<EHistoryEntryType>([
    'MANTECA_QR_PAYMENT' as EHistoryEntryType,
    'SIMPLEFI_QR_PAYMENT' as EHistoryEntryType,
])

// Receipts that show the split-bill prompt + share-receipt button. Kept as
// its own set so "shareable" can diverge from "QR" without a sweep.
const SHAREABLE_RECEIPT_TYPES: ReadonlySet<EHistoryEntryType> = new Set<EHistoryEntryType>([
    'MANTECA_QR_PAYMENT' as EHistoryEntryType,
    'SIMPLEFI_QR_PAYMENT' as EHistoryEntryType,
    'MANTECA_OFFRAMP' as EHistoryEntryType,
    'MANTECA_ONRAMP' as EHistoryEntryType,
])

// Types where the timestamp label reads "Completed" (one-shot bank/onchain
// flows) instead of "Sent"/"Received" (peer-shaped).
const COMPLETED_LABEL_TYPES: ReadonlySet<EHistoryEntryType> = new Set<EHistoryEntryType>([
    'WITHDRAW' as EHistoryEntryType,
    'DEPOSIT' as EHistoryEntryType,
    'BRIDGE_OFFRAMP' as EHistoryEntryType,
    'BRIDGE_ONRAMP' as EHistoryEntryType,
    'BRIDGE_GUEST_OFFRAMP' as EHistoryEntryType,
    'BANK_SEND_LINK_CLAIM' as EHistoryEntryType,
    'MANTECA_OFFRAMP' as EHistoryEntryType,
    'MANTECA_ONRAMP' as EHistoryEntryType,
])

/** QR payments arrive as TRANSACTION_INTENT entries with
 *  `extraData.kind === 'QR_PAY'`; legacy rows in the feed use dedicated
 *  `originalType` values. Recognize both. */
function isTransactionIntentKind(transaction: TransactionDetails, kind: string): boolean {
    return (
        transaction.extraDataForDrawer?.originalType === ('TRANSACTION_INTENT' as EHistoryEntryType) &&
        transaction.extraDataForDrawer?.kind === kind
    )
}

export function isQRPayment(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    if (type && QR_PAYMENT_TYPES.has(type)) return true
    return isTransactionIntentKind(transaction, 'QR_PAY')
}

export function hasShareableReceipt(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    if (type && SHAREABLE_RECEIPT_TYPES.has(type)) return true
    return isTransactionIntentKind(transaction, 'QR_PAY')
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
    return transaction.extraDataForDrawer?.originalType === ('PERK_REWARD' as EHistoryEntryType)
}
