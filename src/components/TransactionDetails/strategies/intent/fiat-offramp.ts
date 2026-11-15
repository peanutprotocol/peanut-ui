import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { personFrom } from '@/lib/person/person'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'
import { normalizeMerchantName } from '@/components/TransactionDetails/transaction-details.utils'
import { formatPixKey } from '@/utils/pix-key-format.utils'
import { isPixEntry } from '@/components/TransactionDetails/pix-entry'

const BANK_CLAIM: TransactionStrategyOutput = {
    direction: 'bank_claim',
    transactionCardType: 'bank_claim',
    nameForDetails: 'Claimed to Bank',
    nameKey: TRANSACTION_NAME_KEYS.claimedToBank,
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
                    entry.recipientAccount?.identifier ??
                    'Recipient',
                nameKey:
                    (entry.recipientAccount?.username ??
                        entry.recipientAccount?.fullName ??
                        entry.recipientAccount?.identifier) != null
                        ? undefined
                        : TRANSACTION_NAME_KEYS.recipient,
                fullName: entry.recipientAccount?.fullName ?? '',
                peer: personFrom(entry.recipientAccount),
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
            nameKey:
                entry.senderAccount?.username || entry.senderAccount?.identifier
                    ? undefined
                    : TRANSACTION_NAME_KEYS.bankAccount,
            peer: personFrom(entry.senderAccount),
            isPeerActuallyUser: !!entry.senderAccount?.isUser,
            isLinkTx: false,
        }
    }
    // A Pix payout to another person's key (TASK-24947) is a send to them, as a Pix-key payment reads
    // (`qrPay`): the holder the lookup named, owner only, with the key beside the name. A shared
    // receipt carries no `pixPayout` and reads as a withdrawal.
    const payout = entry.extraData?.pixPayout
    if (payout?.ownAccount === false) {
        const key = formatPixKey(payout.pixKey)
        return {
            direction: 'send',
            transactionCardType: 'send',
            nameForDetails: payout.holderName ? normalizeMerchantName(payout.holderName) : key,
            nameDetail: payout.holderName ? key : undefined,
            isPeerActuallyUser: false,
            isLinkTx: false,
        }
    }
    // The user's own Pix withdrawal is named by its method, as a Pix deposit is (Aleks, 2026-11-15).
    const pix = isPixEntry(entry)
    return {
        direction: 'bank_withdraw',
        transactionCardType: 'bank_withdraw',
        nameForDetails: pix ? 'Pix' : 'Bank Account',
        nameKey: pix ? TRANSACTION_NAME_KEYS.pix : TRANSACTION_NAME_KEYS.bankAccount,
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
