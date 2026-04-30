import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

const BANK_CLAIM: TransactionStrategyOutput = {
    direction: 'bank_claim',
    transactionCardType: 'bank_claim',
    nameForDetails: 'Claimed to Bank',
    isPeerActuallyUser: false,
    isLinkTx: false,
}

export const bankSendLinkClaim: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    const senderSide = entry.userRole === EHistoryUserRole.SENDER || entry.userRole === EHistoryUserRole.BOTH
    if (senderSide && entry.recipientAccount.isUser) {
        // Claimed by a peanut user (kyc'd or not). Render as direct send.
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
    return BANK_CLAIM
}
