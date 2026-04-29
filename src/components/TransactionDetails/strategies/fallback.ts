// Fallbacks for two cases:
//   1. TRANSACTION_INTENT with an unrecognised kind. Card refunds come
//      back as kind ∈ {OTHER, REFUND} + parentRainTxId set — those route
//      to the cardRefund strategy. Anything else logs to Sentry and
//      renders a defensive "unknown" row.
//   2. Legacy EHistoryEntryType values not covered by a registered
//      strategy. Renders the same default row the legacy switch's
//      `default:` arm produced.

import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from './types'
import { cardRefund } from './intent/card'

export const intentFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'

    // Card refunds come back with kind === 'REFUND' or kind === 'OTHER'
    // alongside provider === RAIN. Scope strictly to these two kinds —
    // guarding only on parentRainTxId would misroute any future intent
    // that happens to carry the linkage.
    if ((kind === 'OTHER' || kind === 'REFUND') && entry.extraData?.parentRainTxId) {
        return cardRefund(entry)
    }

    // Unknown kind — log to Sentry so we catch BE-added kinds the FE
    // doesn't yet handle. Lazy import keeps Sentry out of non-browser
    // bundles (test, SSR). This mirrors the legacy default-arm shape;
    // the Lane 4 FE PR (#1914) consolidates this onto pipelineAlert.
    if (typeof window !== 'undefined') {
        import('@sentry/nextjs')
            .then((Sentry) =>
                Sentry.captureMessage(`transactionTransformer: unhandled TRANSACTION_INTENT kind "${kind}"`, {
                    level: 'warning',
                    tags: { feature: 'history', kind },
                    extra: { entryUuid: entry.uuid, userRole: entry.userRole },
                })
            )
            .catch(() => {})
    }

    return {
        direction: 'send',
        transactionCardType: 'send',
        nameForDetails: entry.recipientAccount?.identifier || 'Transaction',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}

export const legacyFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => ({
    direction: 'send',
    transactionCardType: 'send',
    nameForDetails: entry.recipientAccount?.identifier || 'Unknown',
    isPeerActuallyUser: !!entry.recipientAccount?.isUser,
    isLinkTx: false,
})
