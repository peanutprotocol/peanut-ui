'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { isUserCancellation, type SpendStrategy } from './spendPreflight'

/**
 * Cache-only repair of the backend's stored Rain controller address after a
 * FAILED Rain leg (TASK-22734) — never on success, never a re-submission.
 */

function touchesRain(strategy: SpendStrategy): boolean {
    return strategy === 'collateral-only' || strategy === 'mixed'
}

/**
 * The one exception to "repair on any failure": the user said no, so nothing
 * was signed and the controller was never exercised. Ambiguous and unknown
 * outcomes stay eligible — repairing a cache is safe either way.
 */
function shouldRepairRainController(strategy: SpendStrategy, error: unknown): boolean {
    return touchesRain(strategy) && !isUserCancellation(error)
}

type RepairRainController = (args: { strategy: SpendStrategy; error: unknown }) => Promise<void>

/** Fire-and-forget; never rejects, so the caller's original error stands. */
export const useRainControllerRepair = (): RepairRainController => {
    const queryClient = useQueryClient()

    return useCallback<RepairRainController>(
        async ({ strategy, error }: { strategy: SpendStrategy; error: unknown }) => {
            if (!shouldRepairRainController(strategy, error)) return
            try {
                const { changed } = await rainApi.refreshControllerAddress()
                // Only a real move is worth a refetch. No modal is forced from
                // here — the existing re-enable prompts own that.
                if (changed) {
                    queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
                }
            } catch {
                // A failed lookup leaves the cache intact and must not mask the
                // failure the user is being shown.
            }
        },
        [queryClient]
    )
}
