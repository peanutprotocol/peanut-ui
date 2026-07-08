// Per-kind strategy registry. Every wire entry arrives as
// `type: 'TRANSACTION_INTENT'` with `extraData.kind` set to the raw
// TransactionIntentKind from the BE (or one synthetic — 'PERK_REWARD' for
// perk_usage rows). `dispatchStrategy(entry)` picks the matching strategy
// or falls back to `intentFallback` which routes card refunds to
// `cardRefund` and logs the rest via pipelineAlert.

import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy } from './types'
import { p2pSendOrRequestFulfill } from './intent/p2p-send'
import { sendLink } from './intent/send-link'
import { cryptoDeposit, cryptoWithdraw } from './intent/crypto'
import { fiatOfframp } from './intent/fiat-offramp'
import { fiatOnramp } from './intent/fiat-onramp'
import { perkReward } from './intent/perk-reward'
import { qrPay, cardSpend } from './intent/card'
import { refund } from './intent/refund'
import { intentFallback } from './fallback'

// IntentKind enumerates every raw TransactionIntentKind value the FE
// renders, plus the synthetic 'PERK_REWARD' (sourced from perk_usage rows
// rather than the transaction_intents table). A drift between this union
// and the STRATEGIES map below is a TS error — adding a kind without a
// strategy fails the build.
export type IntentKind =
    | 'DIRECT_TRANSFER'
    | 'SEND_LINK'
    | 'SEND_LINK_CLAIM'
    | 'P2P_REQUEST_FULFILL'
    | 'QR_PAY'
    | 'CRYPTO_DEPOSIT'
    | 'CRYPTO_WITHDRAW'
    | 'ONRAMP'
    | 'OFFRAMP'
    | 'CARD_SPEND_AUTH'
    | 'CARD_SPEND_CLEAR'
    | 'CARD_AUTH_REVERSAL'
    | 'REFUND'
    | 'PERK_REWARD'

const STRATEGIES: Record<IntentKind, TransactionStrategy> = {
    DIRECT_TRANSFER: p2pSendOrRequestFulfill,
    P2P_REQUEST_FULFILL: p2pSendOrRequestFulfill,
    SEND_LINK: sendLink,
    SEND_LINK_CLAIM: sendLink,
    QR_PAY: qrPay,
    CRYPTO_DEPOSIT: cryptoDeposit,
    CRYPTO_WITHDRAW: cryptoWithdraw,
    ONRAMP: fiatOnramp,
    OFFRAMP: fiatOfframp,
    CARD_SPEND_AUTH: cardSpend,
    CARD_SPEND_CLEAR: cardSpend,
    CARD_AUTH_REVERSAL: cardSpend,
    REFUND: refund,
    PERK_REWARD: perkReward,
}

/** Runtime guard that the kind is one the FE renders. */
export function isIntentKind(value: unknown): value is IntentKind {
    return typeof value === 'string' && value in STRATEGIES
}

// Legacy receipt back-compat. Before the decomplexify migration (commit
// b5a0fa2b, May 2026) shareable receipt URLs were `/receipt/<id>?t=<n>`,
// where <n> was the index of the old `EHistoryEntryType` enum. The migration
// switched to `?kind=<IntentKind>` with no back-compat, so every receipt link
// shared or saved before then now 404s. Map the legacy indices whose id is
// still resolvable today: SEND_LINK (the URL carried the sendlink pubKey) and
// the Manteca QR / on-ramp / off-ramp flows (the URL carried the synthetic id
// the BE still indexes via `metadata.mantecaSyntheticId`). Any other `?t=`
// value stays unmapped and 404s as it does today.
//
// Deliberately NOT mapped: `13` (SIMPLEFI_QR_PAYMENT). SimpleFi is a deleted
// provider, and the migration replaced its legacy `simplefi_transfer.id` with
// a fresh random `intent.id` while only preserving `metadata.simplefiPaymentId`
// — which no BE lookup probes. So a `?t=13` link can never resolve; mapping it
// would just turn a client-side 404 into a futile server round-trip. Old
// SimpleFi *list* items still render fine via the QR_PAY strategy; only their
// pre-decomplexify share links are (acceptably) dead.
const LEGACY_RECEIPT_TYPE_INDEX_TO_KIND: Record<string, IntentKind> = {
    '3': 'SEND_LINK', // EHistoryEntryType.SEND_LINK
    '9': 'QR_PAY', // MANTECA_QR_PAYMENT
    '10': 'OFFRAMP', // MANTECA_OFFRAMP
    '11': 'ONRAMP', // MANTECA_ONRAMP
}

/** Resolve the receipt kind from the request's query params, accepting both the
 *  current `?kind=<IntentKind>` and the legacy `?t=<enumIndex>` form so old
 *  shared links keep resolving. Returns undefined when neither yields a kind
 *  the FE renders. */
export function resolveReceiptKind(
    kindParam: string | string[] | undefined,
    legacyTypeParam: string | string[] | undefined
): IntentKind | undefined {
    // searchParams hands back string[] for duplicated query keys (?kind=a&kind=b);
    // take the first value so a valid leading param still resolves.
    const kind = Array.isArray(kindParam) ? kindParam[0] : kindParam
    if (isIntentKind(kind)) return kind
    const legacyType = Array.isArray(legacyTypeParam) ? legacyTypeParam[0] : legacyTypeParam
    if (typeof legacyType === 'string') return LEGACY_RECEIPT_TYPE_INDEX_TO_KIND[legacyType]
    return undefined
}

export function dispatchStrategy(entry: HistoryEntry): TransactionStrategy {
    const kind = entry.extraData?.kind
    if (isIntentKind(kind)) return STRATEGIES[kind]
    return intentFallback
}
