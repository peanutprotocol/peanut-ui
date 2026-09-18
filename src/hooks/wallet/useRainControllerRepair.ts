'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { WebAuthnErrorName } from '@/utils/webauthn.utils'
import { SessionKeyGrantRequiredError, type SpendStrategy } from './spendPreflight'

/**
 * Cache-only repair of the backend's stored Rain controller address after a
 * FAILED Rain leg (TASK-22734) — never on success, never a re-submission.
 */

function touchesRain(strategy: SpendStrategy): boolean {
    return strategy === 'collateral-only' || strategy === 'mixed'
}

const CEREMONY_FAILURE_NAMES = new Set<string>(Object.values(WebAuthnErrorName))

/**
 * The one exception to "repair on any failure": a passkey ceremony that died
 * locally signed nothing, so it never exercised the controller. Ambiguous and
 * unknown outcomes stay eligible — repairing a cache is safe either way.
 */
function isKnownUserCancellation(error: unknown): boolean {
    if (error instanceof SessionKeyGrantRequiredError) return error.cause.kind === 'user-cancelled'
    return error instanceof Error && CEREMONY_FAILURE_NAMES.has(error.name)
}

function shouldRepairRainController(strategy: SpendStrategy, error: unknown): boolean {
    return touchesRain(strategy) && !isKnownUserCancellation(error)
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
