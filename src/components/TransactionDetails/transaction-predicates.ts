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
// Type-only — pins the kind argument of dual-shape predicates to the
// strategy registry's source-of-truth IntentKind union. A drift between a
// predicate kind and the registry is a compile error.
import type { IntentKind } from './strategies/registry'

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
function isTransactionIntentKind(transaction: TransactionDetails, kind: IntentKind): boolean {
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

// Post-M3, send-link rows from the BE arrive as TRANSACTION_INTENT entries with
// extraData.kind === 'LINK_CREATE' (BE: toLegacyKindLabel maps both SEND_LINK and
// SEND_LINK_CLAIM intents → 'LINK_CREATE'). Legacy rows (created pre-cutover and
// still in some histories) keep originalType === SEND_LINK. Recognise both —
// receipt CTAs (QR, Share, Cancel) and the receipt-field exemptions live or die
// by this check.
export function isSendLinkEntry(transaction: TransactionDetails): boolean {
    return (
        transaction.extraDataForDrawer?.originalType === ('SEND_LINK' as EHistoryEntryType) ||
        isTransactionIntentKind(transaction, 'LINK_CREATE')
    )
}

// Request links (individual requests) and request pots (multi-payer requests
// with isRequestLink=true) both arrive as type=REQUEST (legacy rollup, the BE
// pot rollup keeps the legacy type) or as TRANSACTION_INTENT/kind=REQUEST_PAY
// for the post-M3 individual-contribution rows.
export function isRequestEntry(transaction: TransactionDetails): boolean {
    return (
        transaction.extraDataForDrawer?.originalType === ('REQUEST' as EHistoryEntryType) ||
        isTransactionIntentKind(transaction, 'REQUEST_PAY')
    )
}

// Wallet-to-wallet direct send. Legacy originalType is DIRECT_SEND; post-M3
// the row arrives as TRANSACTION_INTENT/kind=P2P_SEND (BE's toLegacyKindLabel
// reuses the P2P_SEND label for the Lane-2b DIRECT_TRANSFER kind).
export function isDirectSendEntry(transaction: TransactionDetails): boolean {
    return (
        transaction.extraDataForDrawer?.originalType === ('DIRECT_SEND' as EHistoryEntryType) ||
        isTransactionIntentKind(transaction, 'P2P_SEND')
    )
}

// Bridge or Manteca on-ramp. Post-M3 the wire kind is 'FIAT_ONRAMP' (not the
// raw BE enum 'ONRAMP' — the BE's toLegacyKindLabel renames it). Two
// pre-existing dual-shape checks in this codebase used 'ONRAMP' literally,
// which silently breaks every new onramp row; route them through here instead.
export function isOnrampEntry(transaction: TransactionDetails): boolean {
    const type = transaction.extraDataForDrawer?.originalType
    if (type === ('BRIDGE_ONRAMP' as EHistoryEntryType)) return true
    if (type === ('MANTECA_ONRAMP' as EHistoryEntryType)) return true
    return isTransactionIntentKind(transaction, 'FIAT_ONRAMP')
}

// Manteca-flavoured onramp specifically (renders the ARS/BRL deposit-info row).
// Provider isn't on the drawer view-model. Legacy rows carried the provider
// via originalType (MANTECA_ONRAMP vs BRIDGE_ONRAMP); post-M3, both collapse
// to TRANSACTION_INTENT/kind=FIAT_ONRAMP. The behavioural discriminator the
// drawer already uses is `extraDataForDrawer.depositInstructions` — Bridge
// onramps ship it (and render their own depositInstructions row instead),
// Manteca onramps don't. So Manteca === FIAT_ONRAMP without depositInstructions.
export function isMantecaOnrampEntry(transaction: TransactionDetails): boolean {
    if (transaction.extraDataForDrawer?.originalType === ('MANTECA_ONRAMP' as EHistoryEntryType)) return true
    if (!isTransactionIntentKind(transaction, 'FIAT_ONRAMP')) return false
    return !transaction.extraDataForDrawer?.depositInstructions
}
