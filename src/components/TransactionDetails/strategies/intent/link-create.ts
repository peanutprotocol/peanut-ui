import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const linkCreate: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === 'RECIPIENT') {
        // Viewer claimed someone else's link. Mirror legacy SEND_LINK × RECIPIENT.
        const isPeerActuallyUser = !!entry.senderAccount?.isUser
        return {
            direction: 'receive',
            transactionCardType: 'receive',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Received via Link',
            fullName: entry.senderAccount?.fullName ?? '',
            showFullName: isPeerActuallyUser ? entry.senderAccount?.showFullName : undefined,
            isPeerActuallyUser,
            isLinkTx: !isPeerActuallyUser,
        }
    }
    // SENDER (creator)
    if (entry.recipientAccount?.isUser) {
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
        direction: 'send',
        transactionCardType: 'send',
        nameForDetails: 'Sent via link',
        isPeerActuallyUser: false,
        isLinkTx: true,
    }
}
