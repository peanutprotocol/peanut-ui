import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from './types'
import { cardRefund } from './intent/card'
import { pipelineAlert } from '@/utils/pipelineAlerts'

export const intentFallback: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'

    // Rain card refunds arrive with parentRainTxId set (provider === RAIN).
    // CARD_AUTH_REVERSAL is the canonical reversal kind (wired in the registry);
    // OTHER / REFUND are kept as a legacy passthrough for rows the BE projector
    // may still emit while it ships the canonical kind. Both lanes route to
    // cardRefund — anything else is logged as an unknown kind.
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

