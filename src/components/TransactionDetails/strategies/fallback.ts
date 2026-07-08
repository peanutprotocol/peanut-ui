import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from './types'
import { cardRefund } from './intent/card'
import { pipelineAlert } from '@/utils/pipelineAlerts'

export const intentFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'

    // Kindless/OTHER historical Rain refund rows carry parentRainTxId —
    // route them to cardRefund. (kind === 'REFUND' never reaches here:
    // the registry dispatches it to the refund strategy.)
    if (kind === 'OTHER' && entry.extraData?.parentRainTxId) {
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
