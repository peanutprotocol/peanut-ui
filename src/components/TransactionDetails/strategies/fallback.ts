import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from './types'
import { cardRefund } from './intent/card'
import { pipelineAlert } from '@/utils/pipelineAlerts'

export const intentFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'

    // Card refunds arrive with kind ∈ {OTHER, REFUND} + parentRainTxId set
    // (provider === RAIN). Scope strictly to these two kinds — guarding only
    // on parentRainTxId would misroute any future intent carrying the linkage.
    if ((kind === 'OTHER' || kind === 'REFUND') && entry.extraData?.parentRainTxId) {
        return cardRefund(entry)
    }

    pipelineAlert(
        'unknown_transformer_kind',
        `transactionTransformer: unhandled TRANSACTION_INTENT kind "${kind}"`,
        { entryUuid: entry.uuid, kind, userRole: entry.userRole },
        'warning'
    )

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
