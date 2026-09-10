import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { parseAsString, useQueryStates } from 'nuqs'
import { useCallback } from 'react'

/**
 * the selected receipt lives in the url (`?tx=<id>`). for surfaces whose rows
 * come from fetched data (history page, home widget) that makes an open
 * receipt survive refresh and deep-link. flow surfaces (qr-pay success,
 * payment success) build their receipt from in-memory state — there the url
 * only drives open/closed within the session, not across a refresh.
 * consumers own the transaction data; this hook only owns which id is selected.
 *
 * call it once per LIST, not per row — every caller subscribes to `?tx=`, so a
 * per-row call re-renders the whole list on any open/close. rows get
 * `isSelected` + the (stable) open/close callbacks as props instead.
 */
export const useTransactionDetailsDrawer = () => {
    const [{ tx }, setParams] = useQueryStates({ tx: parseAsString })

    // stable identities so memo'd rows don't re-render when `tx` changes
    const openTransactionDetails = useCallback(
        (transaction: TransactionDetails) => {
            setParams({ tx: transaction.id ?? null })
        },
        [setParams]
    )

    const closeTransactionDetails = useCallback(() => {
        setParams({ tx: null })
    }, [setParams])

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
