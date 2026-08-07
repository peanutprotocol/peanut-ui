import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'
import { TRANSACTION_NAME_KEYS } from '@/components/TransactionDetails/transaction-name-keys'

export const cryptoDeposit: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => ({
    direction: 'add',
    transactionCardType: 'add',
    nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'Deposit Source',
    nameKey:
        entry.senderAccount?.username || entry.senderAccount?.identifier
            ? undefined
            : TRANSACTION_NAME_KEYS.depositSource,
    fullName: entry.senderAccount?.fullName ?? '',
    showFullName: entry.senderAccount?.showFullName,
    isPeerActuallyUser: !!entry.senderAccount?.isUser,
    isLinkTx: false,
})

export const cryptoWithdraw: TransactionStrategy = (entry: HistoryEntry): TransactionStrategyOutput => {
    if (entry.userRole === EHistoryUserRole.RECIPIENT) {
        return {
            direction: 'add',
            transactionCardType: 'add',
            nameForDetails: entry.senderAccount?.username || entry.senderAccount?.identifier || 'External Wallet',
            nameKey:
                entry.senderAccount?.username || entry.senderAccount?.identifier
                    ? undefined
                    : TRANSACTION_NAME_KEYS.externalWallet,
            isPeerActuallyUser: !!entry.senderAccount?.isUser,
            isLinkTx: false,
        }
    }
    return {
        direction: 'withdraw',
        transactionCardType: 'withdraw',
        nameForDetails: entry.recipientAccount?.identifier || 'External Account',
        nameKey: entry.recipientAccount?.identifier ? undefined : TRANSACTION_NAME_KEYS.externalAccount,
        isPeerActuallyUser: false,
        isLinkTx: false,
    }
}
