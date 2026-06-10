import { cache } from 'react'
import { completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'
import { serverFetch } from '@/utils/api-fetch'

/**
 * Fetches a single history entry from the API. Used for receipt pages.
 *
 * Final-state entries are cacheable; intermediate states are fetched
 * fresh so the shared receipt URL always reflects the latest status.
 *
 * Wrapped in React `cache()`: generateMetadata and the page body both fetch
 * the same entry within one request — this dedupes the second BE roundtrip
 * and guarantees metadata and page render the same snapshot (two live
 * fetches could disagree if the entry settles between them).
 *
 * @param entryId The intent id (or sendlink pubkey, or perk_usage id)
 * @param kind The canonical TransactionIntentKind (or synthetic
 *             'PERK_REWARD' / 'REQUEST_POT'); routes the BE single-entry
 *             dispatcher to the right table.
 */
export const getHistoryEntry = cache(async (entryId: string, kind: string): Promise<HistoryEntry | null> => {
    let response: Response
    try {
        const safeEntryId = encodeURIComponent(entryId)
        const query = new URLSearchParams({ kind }).toString()
        response = await serverFetch(`/history/${safeEntryId}?${query}`)
    } catch (error) {
        throw new Error(`Unexpected error fetching history entry: ${error}`)
    }

    if (!response.ok) {
        if (response.status === 404) {
            return null
        }
        if (response.status === 400) {
            const errorData = await response.json()
            throw new Error(`Sent invalid params when fetching history entry: ${errorData.message ?? errorData.error}`)
        }
        throw new Error(`Failed to fetch history entry: ${response.statusText}`)
    }

    const data = await response.json()
    const entry = await completeHistoryEntry(data)
    return entry
})
