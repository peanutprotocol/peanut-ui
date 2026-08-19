import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { parseAsString, useQueryStates } from 'nuqs'

/**
 * the selected receipt lives in the url (`?tx=<id>`). for surfaces whose rows
 * come from fetched data (history page, home widget) that makes an open
 * receipt survive refresh and deep-link. flow surfaces (qr-pay success,
 * payment success) build their receipt from in-memory state — there the url
 * only drives open/closed within the session, not across a refresh.
 * consumers own the transaction data; this hook only owns which id is selected.
 */
export const useTransactionDetailsDrawer = () => {
    const [{ tx }, setParams] = useQueryStates({ tx: parseAsString })

    const openTransactionDetails = (transaction: TransactionDetails) => {
        setParams({ tx: transaction.id ?? null })
    }

    const closeTransactionDetails = () => {
        setParams({ tx: null })
    }

    /** one match rule for every consumer — null/undefined ids never match. */
    const isTransactionSelected = (id?: string | null) => tx != null && tx === id

    return {
        /** id from `?tx=` — prefer isTransactionSelected over comparing this by hand. */
        selectedTxId: tx,
        isTransactionSelected,
        openTransactionDetails,
        closeTransactionDetails,
    }
}
