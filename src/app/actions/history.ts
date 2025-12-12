'use server'

import { EHistoryEntryType, completeHistoryEntry } from '@/utils/history.utils'
import type { HistoryEntry } from '@/utils/history.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'

/**
 * Fetches a single history entry from the API. This is used for receipts
 *
 * We want to cache the response for final states, that way we have less
 * calls to the backend when sharing the receipt.
 * For intermediate states, we want to avoid caching, so we can show the
 * latest state whenever called.
 *
 * @param entryId The id of the entry to fetch
 * @param entryType The type of the entry to fetch
 * @returns The fetched history entry
 */
export async function getHistoryEntry(entryId: string, entryType: EHistoryEntryType): Promise<HistoryEntry | null> {
    let response: Awaited<ReturnType<typeof fetchWithSentry>>
    try {
        response = await fetchWithSentry(`${PEANUT_API_URL}/history/${entryId}?entryType=${entryType}`)
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
