import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const sendLink: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.SENDER) {
        const nameForDetails =
            entry.recipientAccount?.username ||
            entry.recipientAccount?.identifier ||
            (entry.status === 'COMPLETED' ? 'You sent via link' : "You're sending via link")
        const isPeerActuallyUser = !!entry.recipientAccount?.isUser
        return {
            direction: 'send',
            transactionCardType: 'send',
            nameForDetails,
            fullName: entry.recipientAccount?.fullName ?? '',
            showFullName: entry.recipientAccount?.showFullName,
            isPeerActuallyUser,
            isLinkTx: !isPeerActuallyUser,
        }
    }
    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        if (entry.recipientAccount && !entry.recipientAccount.isUser) {
            return {
                direction: 'claim_external',
                transactionCardType: 'claim_external',
                nameForDetails: entry.recipientAccount.identifier,
                isPeerActuallyUser: false,
                isLinkTx: true,
            }
        }
        const isPeerActuallyUser = !!entry.senderAccount?.isUser
        return {
            direction: 'receive',
            transactionCardType: 'receive',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Received via Link',
            fullName: entry.senderAccount?.fullName ?? '',
            showFullName: entry.senderAccount?.showFullName,
            isPeerActuallyUser,
            isLinkTx: !isPeerActuallyUser,
        }
    }
    if (entry.userRole === EHistoryUserRole.BOTH) {
        // Sender claimed their own link → cancelled. uiStatus override
        // matches the pre-strategy switch (set uiStatus='cancelled' before
        // the global status mapper runs).
        return {
            direction: 'send',
            transactionCardType: 'send',
            nameForDetails: 'Sent via Link',
            isPeerActuallyUser: true,
            isLinkTx: true,
            uiStatus: 'cancelled',
        }
    }
    // userRole = SENDER_PUBLIC / unknown — public-link claim path
    return {
        direction: 'claim_external',
        transactionCardType: 'claim_external',
        nameForDetails: entry.recipientAccount?.username || entry.recipientAccount?.identifier || '',
        fullName: entry.recipientAccount?.fullName ?? '',
        showFullName: entry.recipientAccount?.showFullName,
        isPeerActuallyUser: false,
        isLinkTx: true,
    }
}
