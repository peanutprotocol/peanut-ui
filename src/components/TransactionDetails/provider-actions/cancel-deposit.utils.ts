import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { isMantecaOnrampEntry, isRequestEntry } from '@/components/TransactionDetails/transaction-predicates'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'

export type CancelDepositKind = 'bridge-onramp' | 'manteca-onramp' | 'bank-request'

/**
 * Which cancel branch CancelDepositActions renders, or null when the entry
 * cannot be cancelled. The receipt reads this too, so the cancel button can
 * take the primary slot while it is available.
 */
export function getCancelDepositKind(
    transaction: TransactionDetails,
    isPendingBankRequest: boolean
): CancelDepositKind | null {
    // REQUEST rows are excluded here; they take the bank-request branch.
    if (
        transaction.direction === 'bank_deposit' &&
        !isRequestEntry(transaction) &&
        transaction.status === 'pending' &&
        !!transaction.extraDataForDrawer?.depositInstructions
    ) {
        return 'bridge-onramp'
    }
    if (isMantecaOnrampEntry(transaction) && transaction.status === 'pending') return 'manteca-onramp'
    if (isPendingBankRequest && transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER) {
        return 'bank-request'
    }
    return null
}
