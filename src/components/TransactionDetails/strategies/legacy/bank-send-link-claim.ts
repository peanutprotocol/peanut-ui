import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const bankSendLinkClaim: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.SENDER || entry.userRole === EHistoryUserRole.BOTH) {
        if (entry.recipientAccount.isUser) {
            // Cases 1 & 2: claimed by a peanut user (kyc'd or not). Render as direct send.
            return {
                direction: 'send',
                transactionCardType: 'send',
                nameForDetails:
                    entry.recipientAccount?.username ??
                    entry.recipientAccount?.fullName ??
                    entry.recipientAccount?.identifier,
                fullName: entry.recipientAccount?.fullName ?? '',
                isPeerActuallyUser: true,
                isLinkTx: false,
            }
        }
        // Case 3: claimed by a guest. Render as generic bank claim.
        return {
            direction: 'bank_claim',
            transactionCardType: 'bank_claim',
            nameForDetails: 'Claimed to Bank',
            isPeerActuallyUser: false,
            isLinkTx: false,
        }
    }
    // Claimant's perspective — always a bank claim.
    return {
        direction: 'bank_claim',
        transactionCardType: 'bank_claim',
        nameForDetails: 'Claimed to Bank',
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
