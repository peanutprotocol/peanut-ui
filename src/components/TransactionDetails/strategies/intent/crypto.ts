import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const cryptoDeposit: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => ({
    direction: 'add',
    transactionCardType: 'add',
    nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Deposit Source',
    fullName: entry.senderAccount?.fullName ?? '',
    showFullName: entry.senderAccount?.showFullName,
    isPeerActuallyUser: !!entry.senderAccount?.isUser,
    isLinkTx: false,
})

export const cryptoWithdraw: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        return {
            direction: 'add',
            transactionCardType: 'add',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'External Wallet',
            isPeerActuallyUser: !!entry.senderAccount?.isUser,
            isLinkTx: false,
        }
    }
    return {
        direction: 'withdraw',
        transactionCardType: 'withdraw',
        nameForDetails: entry.recipientAccount?.identifier || 'External Account',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
