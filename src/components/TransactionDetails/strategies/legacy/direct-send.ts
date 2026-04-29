import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const directSend: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.SENDER) {
        return {
            direction: 'send',
            transactionCardType: 'send',
            nameForDetails: entry.recipientAccount?.username ?? entry.recipientAccount?.identifier ?? '',
            fullName: entry.recipientAccount?.fullName ?? '',
            showFullName: entry.recipientAccount?.showFullName,
            isPeerActuallyUser: true,
            isLinkTx: false,
        }
    }
    return {
        direction: 'receive',
        transactionCardType: 'receive',
        nameForDetails: entry.senderAccount?.username ?? entry.senderAccount?.identifier ?? 'Requested via Link',
        fullName: entry.senderAccount?.fullName ?? '',
        showFullName: entry.senderAccount?.showFullName,
        isPeerActuallyUser: true,
        // Original behaviour: if the sender side has no senderAccount, the
        // entry was created by an external (non-Peanut) actor, render as a
        // public-link receive. The legacy switch toggled `isLinkTx` based on
        // `!entry.senderAccount` regardless of `isPeerActuallyUser`.
        isLinkTx: !entry.senderAccount,
    }
}
