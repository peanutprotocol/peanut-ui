// Composite-key registry for the transformer's per-kind strategies.
//
// Key shape:
//   - Legacy EHistoryEntryType cases: just the type ("DIRECT_SEND")
//   - TRANSACTION_INTENT cases: "TRANSACTION_INTENT:<kind>" so each
//     intent kind owns its own strategy without nested-switch dispatch.
//
// `dispatchStrategy(entry)` returns the matching strategy, or — for
// TRANSACTION_INTENT entries with an unknown kind — the intent fallback,
// which routes card refunds to cardRefund and logs the rest via
// pipelineAlert. Legacy types with no strategy fall to legacyFallback.

import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy } from './types'
import { directSend } from './legacy/direct-send'
import { sendLink } from './legacy/send-link'
import { request } from './legacy/request'
import { bankSendLinkClaim } from './legacy/bank-send-link-claim'
import {
    withdraw,
    cashout,
    bankOfframp,
    bankOnramp,
    deposit,
    mantecaQrPayment,
    simplefiQrPayment,
    perkReward,
} from './legacy/external-account'
import { p2pSendOrRequestPay } from './intent/p2p-send'
import { linkCreate } from './intent/link-create'
import { cryptoDeposit, cryptoWithdraw } from './intent/crypto'
import { fiatOfframp } from './intent/fiat-offramp'
import { qrPay, cardSpend } from './intent/card'
import { intentFallback, legacyFallback } from './fallback'

// String literal values match the EHistoryEntryType enum (history.utils.ts)
// and the BE TransactionIntentKind enum. Inlined here so tests that mock
// `@/hooks/useTransactionHistory` (and thus break the enum re-export) can
// still load this module — the registry is wired at module-init time.
const TRANSACTION_INTENT = 'TRANSACTION_INTENT'

// Legacy EHistoryEntryType values handled by a strategy. Adding a new legacy
// type here without a corresponding entry in STRATEGIES is a compile error.
type LegacyKey =
    | 'DIRECT_SEND'
    | 'SEND_LINK'
    | 'REQUEST'
    | 'WITHDRAW'
    | 'CASHOUT'
    | 'BRIDGE_OFFRAMP'
    | 'MANTECA_OFFRAMP'
    | 'BANK_SEND_LINK_CLAIM'
    | 'BRIDGE_ONRAMP'
    | 'MANTECA_ONRAMP'
    | 'DEPOSIT'
    | 'MANTECA_QR_PAYMENT'
    | 'SIMPLEFI_QR_PAYMENT'
    | 'PERK_REWARD'

// TRANSACTION_INTENT kinds rendered by an explicit strategy. Adding a new
// BE TransactionIntentKind that should render distinctly requires updating
// this union AND the STRATEGIES map below — TS guarantees both move together.
type IntentKind =
    | 'P2P_SEND'
    | 'REQUEST_PAY'
    | 'QR_PAY'
    | 'LINK_CREATE'
    | 'CRYPTO_DEPOSIT'
    | 'CRYPTO_WITHDRAW'
    | 'FIAT_OFFRAMP'
    | 'FIAT_ONRAMP'
    | 'CARD_SPEND'

type RegistryKey = LegacyKey | `${typeof TRANSACTION_INTENT}:${IntentKind}`

const INTENT_KEY = <K extends IntentKind>(kind: K): `${typeof TRANSACTION_INTENT}:${K}` =>
    `${TRANSACTION_INTENT}:${kind}`

const STRATEGIES: Record<RegistryKey, TransactionStrategy> = {
    DIRECT_SEND: directSend,
    SEND_LINK: sendLink,
    REQUEST: request,
    WITHDRAW: withdraw,
    CASHOUT: cashout,
    BRIDGE_OFFRAMP: bankOfframp,
    MANTECA_OFFRAMP: bankOfframp,
    BANK_SEND_LINK_CLAIM: bankSendLinkClaim,
    BRIDGE_ONRAMP: bankOnramp,
    MANTECA_ONRAMP: bankOnramp,
    DEPOSIT: deposit,
    MANTECA_QR_PAYMENT: mantecaQrPayment,
    SIMPLEFI_QR_PAYMENT: simplefiQrPayment,
    PERK_REWARD: perkReward,
    [INTENT_KEY('P2P_SEND')]: p2pSendOrRequestPay,
    [INTENT_KEY('REQUEST_PAY')]: p2pSendOrRequestPay,
    [INTENT_KEY('QR_PAY')]: qrPay,
    [INTENT_KEY('LINK_CREATE')]: linkCreate,
    [INTENT_KEY('CRYPTO_DEPOSIT')]: cryptoDeposit,
    [INTENT_KEY('CRYPTO_WITHDRAW')]: cryptoWithdraw,
    [INTENT_KEY('FIAT_OFFRAMP')]: fiatOfframp,
    [INTENT_KEY('FIAT_ONRAMP')]: bankOnramp,
    [INTENT_KEY('CARD_SPEND')]: cardSpend,
}

function key(entry: HistoryEntry): string {
    if (entry.type === TRANSACTION_INTENT) {
        const kind = (entry.extraData?.kind as string | undefined) ?? ''
        return `${TRANSACTION_INTENT}:${kind}`
    }
    return String(entry.type)
}

export function dispatchStrategy(entry: HistoryEntry): TransactionStrategy {
    const direct = (STRATEGIES as Record<string, TransactionStrategy>)[key(entry)]
    if (direct) return direct
    if (entry.type === TRANSACTION_INTENT) return intentFallback
    return legacyFallback
}
