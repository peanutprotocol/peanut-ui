import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from './types'
import { cardRefund } from './intent/card'

export const intentFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'

    // Card refunds arrive with kind ∈ {OTHER, REFUND} + parentRainTxId set
    // (provider === RAIN). Scope strictly to these two kinds — guarding only
    // on parentRainTxId would misroute any future intent carrying the linkage.
    if ((kind === 'OTHER' || kind === 'REFUND') && entry.extraData?.parentRainTxId) {
        return cardRefund(entry)
    }

    // Lazy Sentry import keeps it out of test / SSR bundles. PR #1914 will
    // consolidate this onto the shared pipelineAlert helper.
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
