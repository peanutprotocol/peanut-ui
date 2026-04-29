import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const fiatOfframp: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === 'RECIPIENT') {
        // Multi-user fulfillment edge case — viewer received a bank
        // withdraw initiated by another user. USDC arrives in viewer's
        // wallet from offramp funder.
        return {
            direction: 'receive',
            transactionCardType: 'receive',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Bank Account',
            isPeerActuallyUser: !!entry.senderAccount?.isUser,
            isLinkTx: false,
        }
    }
    return {
        direction: 'bank_withdraw',
        transactionCardType: 'bank_withdraw',
        nameForDetails: 'Bank Account',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
