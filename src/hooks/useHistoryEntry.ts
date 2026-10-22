import { useQuery } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'
import { type IntentKind } from '@/components/TransactionDetails/strategies/registry'
import { apiFetch } from '@/utils/api-fetch'
import { completeHistoryEntry, isSettling, type HistoryEntry } from '@/utils/history.utils'

const SETTLING_POLL_MS = 15_000

/**
 * One history entry, read by id and kind from GET /history/:id. The API
 * resolves an entry by both, so the wrong kind 404s even with the right id.
 *
 * Polls every 15 s while the receipt can still change (`isSettling`): a
 * pending transaction can settle, and a withdrawal's network fee can land
 * after the row completes.
 */
export function useHistoryEntry(
    entryId: string | null | undefined,
    kind: IntentKind | undefined,
    { enabled = true, retry }: { enabled?: boolean; retry?: boolean } = {}
) {
    return useQuery({
        queryKey: [TRANSACTIONS, 'entry', entryId, kind],
        enabled: enabled && Boolean(entryId && kind),
        ...(retry !== undefined && { retry }),
        queryFn: async (): Promise<HistoryEntry> => {
            const response = await apiFetch(`/history/${encodeURIComponent(entryId!)}?kind=${kind}`)
            if (!response.ok) throw new Error(`Failed to fetch history entry: ${response.status}`)
            return completeHistoryEntry(await response.json())
        },
        refetchInterval: (query) =>
            query.state.data && isSettling(query.state.data, Date.now()) ? SETTLING_POLL_MS : false,
    })
}
