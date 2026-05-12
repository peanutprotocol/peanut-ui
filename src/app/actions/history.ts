import { completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'
import { serverFetch } from '@/utils/api-fetch'

/**
 * Fetches a single history entry from the API. Used for receipt pages.
 *
 * Final-state entries are cacheable; intermediate states are fetched
 * fresh so the shared receipt URL always reflects the latest status.
 *
 * @param entryId The intent id (or sendlink pubkey, or perk_usage id)
 * @param kind The canonical TransactionIntentKind (or synthetic
 *             'PERK_REWARD' / 'REQUEST_POT'); routes the BE single-entry
 *             dispatcher to the right table.
 */
export async function getHistoryEntry(entryId: string, kind: string): Promise<HistoryEntry | null> {
    let response: Response
    try {
        response = await serverFetch(`/history/${entryId}?kind=${kind}`)
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
}
