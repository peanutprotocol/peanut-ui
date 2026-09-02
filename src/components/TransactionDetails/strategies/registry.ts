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
import { internalTransfer, chargeback } from './intent/ledger-generic'
import { intentFallback } from './fallback'
import { type paths } from '@/types/api.generated'

// IntentKind is DERIVED from the generated OpenAPI types (TASK-21817): the
// BE declares its wire-kind vocabulary — every TransactionIntentKind enum
// value plus the synthetic 'PERK_REWARD' — on the /history/{entryId} `kind`
// parameter, and `pnpm gen:api` carries it here. The STRATEGIES map below
// is Record<IntentKind, …>, so a BE enum addition becomes a COMPILE ERROR
// on the next type regen instead of a row that silently falls through to
// the fallback and renders as an outgoing send (TASK-21403's failure
// shape). No hand-maintained kind list remains.
export type IntentKind = paths['/history/{entryId}']['get']['parameters']['query']['kind']

const STRATEGIES: Record<IntentKind, TransactionStrategy> = {
    DIRECT_TRANSFER: p2pSendOrRequestFulfill,
    // Legacy charge-backed sends (pre-2026-04 rows; no new writes).
    P2P_SEND: p2pSendOrRequestFulfill,
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
    // Reward payouts are credits from Peanut — same face as perk rewards.
    REWARD_PAYOUT: perkReward,
    INTERNAL_TRANSFER: internalTransfer,
    CHARGEBACK: chargeback,
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
// Deliberately NOT mapped: `13` (the removed SimpleFi QR provider). The
// migration replaced its legacy ids with fresh random `intent.id`s and no BE
// lookup probes the preserved metadata, so a `?t=13` link can never resolve —
// mapping it would just turn a client-side 404 into a futile server
// round-trip. Historical DEPRECATED_SIMPLEFI *list* rows still render via the
// QR_PAY strategy; only their pre-decomplexify share links are dead.
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
