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
// Type-only import — the runtime enum lives in utils/history.utils, which
// ends up in a circular load with this file under the jest module graph
// (utils/history.utils → transactionTransformer → TransactionCard →
// transaction-predicates → back to utils/history.utils, mid-evaluation).
// Importing only the type lets the transpiler erase this line entirely;
// the Sets below use string literals because EHistoryEntryType is a string
// enum, so the runtime values are interchangeable with their literal forms.
import type { EHistoryEntryType } from '@/utils/history.utils'

const QR_PAYMENT_TYPES: ReadonlySet<EHistoryEntryType> = new Set<EHistoryEntryType>([
    'MANTECA_QR_PAYMENT' as EHistoryEntryType,
    'SIMPLEFI_QR_PAYMENT' as EHistoryEntryType,
])

// Types whose receipt is shareable (split-bill prompt + share-receipt button).
// Same as QR-payments today plus Manteca on/off-ramps; kept as its own set so
// "shareable" can diverge from "QR" later without a sweep.
const SHAREABLE_RECEIPT_TYPES: ReadonlySet<EHistoryEntryType> = new Set<EHistoryEntryType>([
    'MANTECA_QR_PAYMENT' as EHistoryEntryType,
    'SIMPLEFI_QR_PAYMENT' as EHistoryEntryType,
    'MANTECA_OFFRAMP' as EHistoryEntryType,
    'MANTECA_ONRAMP' as EHistoryEntryType,
])

// Types where the timestamp label reads "Completed" (one-shot bank/onchain
// flows) instead of "Sent"/"Received" (peer-shaped flows).
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

/** Post-M3, QR payments arrive as TRANSACTION_INTENT entries with
 *  `extraData.kind === 'QR_PAY'`. Pre-M3 (legacy rows still in the feed)
 *  used dedicated `originalType` values. Recognize both. */
function isTransactionIntentKind(transaction: TransactionDetails, kind: string): boolean {
    // String comparison — see top-of-file note on the type-only import. The
    // enum value 'TRANSACTION_INTENT' is identical to its string at runtime.
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
    // QR payments via the unified intent path should also be shareable.
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
