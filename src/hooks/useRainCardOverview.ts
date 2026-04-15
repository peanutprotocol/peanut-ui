'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rainApi, type RainCardOverview } from '@/services/rain'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { RailStatusUpdate, RainCardBalanceChangedData } from '@/services/websocket'

export const RAIN_CARD_OVERVIEW_QUERY_KEY = 'rain-card-overview'

/**
 * Fetches the composite Rain card state (application status, collateral
 * balance, issued cards) for the authenticated user.
 *
 * Polls every 30s and refetches on window focus. Subscribes to two
 * WebSocket events for real-time invalidation:
 *   - `user_rail_status_changed` — rail transitions (PENDING → ENABLED).
 *   - `rain_card_balance_changed` — card txns, auto-balancer deposits,
 *     collateral contract deployment.
 */
export const useRainCardOverview = () => {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const userId = user?.user?.userId

    const query = useQuery<RainCardOverview>({
        queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY, userId],
        queryFn: () => rainApi.getOverview(),
        enabled: !!userId,
        staleTime: 30_000,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
    })

    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY, userId] })
    }, [queryClient, userId])

    const handleRailStatusUpdate = useCallback((_data: RailStatusUpdate) => invalidate(), [invalidate])
    const handleRainCardBalanceChanged = useCallback(
        (data: RainCardBalanceChangedData) => {
            invalidate()
            // auto_balance_deposit moves USDC out of the smart account into Rain
            // collateral — if we only refresh the rain side, the spendable sum
            // temporarily inflates until useBalance's next 30s poll. Invalidate
            // the wallet balance query too so both buckets stay in sync.
            if (data.reason === 'auto_balance_deposit') {
                queryClient.invalidateQueries({ queryKey: ['balance'] })
            }
        },
        [invalidate, queryClient]
    )

    useWebSocket({
        username: user?.user?.username ?? undefined,
        autoConnect: !!userId,
        onRailStatusUpdate: handleRailStatusUpdate,
        onRainCardBalanceChanged: handleRainCardBalanceChanged,
    })

    return {
        overview: query.data,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    }
}
