import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const fiatOfframp: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        // Multi-user fulfilment: viewer received USDC from an offramp
        // initiated by another user.
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
