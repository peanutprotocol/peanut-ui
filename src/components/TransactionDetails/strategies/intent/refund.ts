import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { cardRefund } from './card'

// Strategy for kind=REFUND intents (any provider). Two shapes converge here:
//
//   - Rain card refunds — provider RAIN, or carrying `parentRainTxId`. These
//     mirror the card-spend refund exactly: "Refund from {merchant}", the
//     credit-card avatar, direction 'receive'. Delegate to `cardRefund` so the
//     two lanes stay identical.
//   - Manteca QR-pay refunds — no Rain signal. A generic "Refund" credit row.
//
// Both keep direction 'receive' (drives the '+' sign) and transactionCardType
// 'refund' (drives the arrow-down-left icon + "Refund" label). The refund row
// is the *credit*; the original spend row keeps its own REFUNDED strikethrough.
export const refund: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    // Rain when EITHER signal is present — provider tells us directly, and
    // parentRainTxId catches older/kindless rows that predate the provider
    // field. A Manteca refund has neither, so it falls through to the
    // generic shape.
    const isRainRefund = entry.extraData?.provider === 'RAIN' || !!entry.extraData?.parentRainTxId
    if (isRainRefund) {
        return cardRefund(entry)
    }

    return {
        direction: 'receive',
        transactionCardType: 'refund',
        nameForDetails: 'Refund',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
