import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { parseAsString, useQueryStates } from 'nuqs'

/**
 * the selected receipt lives in the url (`?tx=<id>`), so an open transaction
 * drawer survives a refresh and can be deep-linked/shared. consumers own the
 * transaction data; this hook only owns which id is selected.
 */
export const useTransactionDetailsDrawer = () => {
    const [{ tx }, setParams] = useQueryStates({ tx: parseAsString })

    const openTransactionDetails = (transaction: TransactionDetails) => {
        setParams({ tx: transaction.id })
    }

    const closeTransactionDetails = () => {
        setParams({ tx: null })
    }

    return {
        /** id from `?tx=` — compare against a row's transaction id to decide if its drawer is open. */
        selectedTxId: tx,
        openTransactionDetails,
        closeTransactionDetails,
    }
}
