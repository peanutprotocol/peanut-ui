import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

const BANK_CLAIM: TransactionStrategyOutput = {
    direction: 'bank_claim',
    transactionCardType: 'bank_claim',
    nameForDetails: 'Claimed to Bank',
    isPeerActuallyUser: false,
    isLinkTx: false,
}

export const fiatOfframp: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    // Bank send-link claim: an OFFRAMP intent whose recipient is a Peanut
    // sendLinkPubKey (claim flow). BE flags it via extraData.bridgeFlow.
    // Two sub-cases:
    //   1. Claimed by a Peanut user → render as a direct send to the claimer.
    //   2. Claimed externally (no user account) → render as "Claimed to Bank".
    if (entry.extraData?.bridgeFlow === 'BANK_SEND_LINK_CLAIM') {
        const senderSide = entry.userRole === EHistoryUserRole.SENDER || entry.userRole === EHistoryUserRole.BOTH
        if (senderSide && entry.recipientAccount?.isUser) {
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

    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        // Multi-user fulfillment edge case — viewer received a bank
        // withdraw initiated by another user. USDC arrives in viewer's
        // wallet from offramp funder.
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
