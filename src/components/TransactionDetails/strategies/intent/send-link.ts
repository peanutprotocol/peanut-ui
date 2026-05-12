// SEND_LINK — claim-by-link transfer. Covers all four userRole paths:
// SENDER (waiting for claim), RECIPIENT (viewer claimed someone's link),
// BOTH (sender reclaimed their own link → cancelled), and the
// no-user-account public-link claim path.

import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const sendLink: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
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
        // Viewer claimed someone else's link.
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
    if (entry.userRole === EHistoryUserRole.BOTH) {
        // Sender claimed their own link → cancelled. The uiStatus override
        // pre-empts the global status mapper.
        return {
            direction: 'send',
            transactionCardType: 'send',
            nameForDetails: 'Sent via Link',
            isPeerActuallyUser: true,
            isLinkTx: true,
            uiStatus: 'cancelled',
        }
    }
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
