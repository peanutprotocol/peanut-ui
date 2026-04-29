import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const request: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.extraData?.fulfillmentType === 'bridge' && entry.userRole === EHistoryUserRole.SENDER) {
        return {
            direction: 'bank_request_fulfillment',
            transactionCardType: 'bank_request_fulfillment',
            nameForDetails: entry.recipientAccount?.username ?? entry.recipientAccount?.identifier ?? '',
            fullName: entry.recipientAccount?.fullName ?? '',
            showFullName: entry.recipientAccount?.showFullName,
            isPeerActuallyUser: !!entry.recipientAccount?.isUser || !!entry.senderAccount?.isUser,
            // Mirrors the legacy fall-through: REQUEST × bridge × SENDER
            // doesn't explicitly set isLinkTx, so it lands on the
            // post-switch `isLinkTx = !isPeerActuallyUser` line.
            isLinkTx: !(!!entry.recipientAccount?.isUser || !!entry.senderAccount?.isUser),
        }
    }
    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        const isPeerActuallyUser = !!entry.senderAccount?.isUser
        return {
            direction: 'request_sent',
            transactionCardType: 'request',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Requested via Link',
            fullName: entry.senderAccount?.fullName ?? '',
            showFullName: entry.senderAccount?.showFullName,
            isPeerActuallyUser,
            isLinkTx: !isPeerActuallyUser,
        }
    }
    if (
        entry.status?.toUpperCase() === 'NEW' ||
        (entry.status?.toUpperCase() === 'PENDING' && !entry.extraData?.fulfillmentType)
    ) {
        const isPeerActuallyUser = !!entry.recipientAccount?.isUser
        return {
            direction: 'request_received',
            transactionCardType: 'request',
            nameForDetails:
                entry.recipientAccount?.username ||
                entry.recipientAccount?.identifier ||
                `Request From ${entry.recipientAccount?.username || entry.recipientAccount?.identifier}`,
            fullName: entry.recipientAccount?.fullName ?? '',
            showFullName: entry.recipientAccount?.showFullName,
            isPeerActuallyUser,
            isLinkTx: !isPeerActuallyUser,
        }
    }
    const isPeerActuallyUser = !!entry.recipientAccount?.isUser
    return {
        direction: 'send',
        transactionCardType: 'send',
        nameForDetails: entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Paid Request To',
        fullName: entry.recipientAccount?.fullName ?? '',
        isPeerActuallyUser,
        isLinkTx: !isPeerActuallyUser,
    }
}
