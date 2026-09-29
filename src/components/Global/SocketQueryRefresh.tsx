'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { RainCardBalanceChangedData } from '@/services/websocket'

/**
 * The one socket listener that refreshes cached queries. Mounted once in
 * AppFlowProviders; renders nothing.
 *
 * These invalidations used to run in every listener. useRainCardOverview opened
 * one per consumer, and useWallet reaches it, so dozens were live on home: one
 * ping made each invalidate, each invalidation restarted the history fetch, and
 * on 2026-09-24 one ping sent ~100 identical GET /users/history in half a
 * second, which drove the staging database into an OOM kill.
 */
export function SocketQueryRefresh() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const userId = user?.user?.userId

    // Default cancelRefetch (true) on purpose: a fetch already in flight when
    // the ping arrives started before the change and may lack the new row, so
    // it is aborted and restarted rather than joined.
    const refetchHistoryAndBalance = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        queryClient.invalidateQueries({ queryKey: ['balance'] })
    }, [queryClient])

    const refetchRainOverview = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY, userId] })
    }, [queryClient, userId])

    const handleRainCardBalanceChanged = useCallback(
        (data: RainCardBalanceChangedData) => {
            refetchRainOverview()
            // auto_balance_deposit moves USDC out of the smart account into Rain
            // collateral — if only the rain side refreshes, the spendable sum
            // inflates until useBalance's next 30s poll.
            if (data.reason === 'auto_balance_deposit') {
                queryClient.invalidateQueries({ queryKey: ['balance'] })
            }
        },
        [refetchRainOverview, queryClient]
    )

    useWebSocket({
        username: user?.user?.username ?? undefined,
        autoConnect: !!userId,
        onRefetchRequested: refetchHistoryAndBalance,
        onRailStatusUpdate: refetchRainOverview,
        onRainCardBalanceChanged: handleRainCardBalanceChanged,
    })

    return null
}
