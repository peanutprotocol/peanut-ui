// DIRECT_TRANSFER (peer-to-peer send) and P2P_REQUEST_FULFILL (payer side
// of a request) share this strategy. They differ only on the bridge-fulfilled
// branch — P2P_REQUEST_FULFILL via bridge renders as bank_request_fulfillment.

import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'

export const p2pSendOrRequestFulfill: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const kind = entry.extraData?.kind as string | undefined

    // Bridge-fulfilled requests render as bank-request fulfillments on the
    // sender side. Viewer is paying via bank rails.
    if (
        kind === 'P2P_REQUEST_FULFILL' &&
        entry.extraData?.fulfillmentType === 'bridge' &&
        entry.userRole === EHistoryUserRole.SENDER
    ) {
        return {
            direction: 'bank_request_fulfillment',
            transactionCardType: 'bank_request_fulfillment',
            nameForDetails: entry.recipientAccount?.username ?? entry.recipientAccount?.identifier ?? 'Recipient',
            nameKey:
                (entry.recipientAccount?.username ?? entry.recipientAccount?.identifier) != null
                    ? undefined
                    : TRANSACTION_NAME_KEYS.recipient,
            fullName: entry.recipientAccount?.fullName ?? '',
            showFullName: entry.recipientAccount?.showFullName,
            isPeerActuallyUser: !!entry.recipientAccount?.isUser,
            isLinkTx: false,
        }
    }

    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        const senderResolved = !!entry.senderAccount?.identifier
        if (senderResolved) {
            return {
                direction: 'receive',
                transactionCardType: 'receive',
                nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Sender',
                nameKey:
                    entry.senderAccount?.username || entry.senderAccount?.identifier
                        ? undefined
                        : TRANSACTION_NAME_KEYS.sender,
                fullName: entry.senderAccount?.fullName ?? '',
                showFullName: entry.senderAccount?.showFullName,
                isPeerActuallyUser: !!entry.senderAccount?.isUser,
                isLinkTx: false,
            }
        }
        // Unfulfilled request the viewer created.
        return {
            direction: 'request_received',
            transactionCardType: 'request',
            nameForDetails: 'Request',
            nameKey: TRANSACTION_NAME_KEYS.request,
            isPeerActuallyUser: false,
            isLinkTx: false,
        }
    }

    return {
        direction: 'send',
        transactionCardType: 'send',
        nameForDetails: entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Recipient',
        nameKey:
            entry.recipientAccount?.username || entry.recipientAccount?.identifier
                ? undefined
                : TRANSACTION_NAME_KEYS.recipient,
        fullName: entry.recipientAccount?.fullName ?? '',
        showFullName: entry.recipientAccount?.showFullName,
        isPeerActuallyUser: !!entry.recipientAccount?.isUser,
        isLinkTx: false,
    }
}
