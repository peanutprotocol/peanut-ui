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
import { intentFallback } from './fallback'

// IntentKind enumerates every raw TransactionIntentKind value the FE
// renders, plus the synthetic 'PERK_REWARD' (sourced from perk_usage rows
// rather than the transaction_intents table). A drift between this union
// and the STRATEGIES map below is a TS error — adding a kind without a
// strategy fails the build.
export type IntentKind =
    | 'DIRECT_TRANSFER'
    | 'SEND_LINK'
    | 'P2P_REQUEST_FULFILL'
    | 'QR_PAY'
    | 'CRYPTO_DEPOSIT'
    | 'CRYPTO_WITHDRAW'
    | 'ONRAMP'
    | 'OFFRAMP'
    | 'CARD_SPEND_AUTH'
    | 'CARD_SPEND_CLEAR'
    | 'CARD_AUTH_REVERSAL'
    | 'PERK_REWARD'

const STRATEGIES: Record<IntentKind, TransactionStrategy> = {
    DIRECT_TRANSFER: p2pSendOrRequestFulfill,
    P2P_REQUEST_FULFILL: p2pSendOrRequestFulfill,
    SEND_LINK: sendLink,
    QR_PAY: qrPay,
    CRYPTO_DEPOSIT: cryptoDeposit,
    CRYPTO_WITHDRAW: cryptoWithdraw,
    ONRAMP: fiatOnramp,
    OFFRAMP: fiatOfframp,
    CARD_SPEND_AUTH: cardSpend,
    CARD_SPEND_CLEAR: cardSpend,
    CARD_AUTH_REVERSAL: cardSpend,
    PERK_REWARD: perkReward,
}

export function dispatchStrategy(entry: HistoryEntry): TransactionStrategy {
    const kind = entry.extraData?.kind as IntentKind | undefined
    if (kind && STRATEGIES[kind]) return STRATEGIES[kind]
    return intentFallback
}
