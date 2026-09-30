'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { TRANSACTIONS } from '@/constants/query.consts'
import type { RainCardBalanceChangedData } from '@/services/websocket'

// One webhook can move several rails, and each moved rail is its own push, all
// within milliseconds. Pushes inside this window share one GET /users/me.
const USER_REFETCH_WINDOW_MS = 500

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
    const { user, fetchUser } = useAuth()
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

    // The Home card and Profile tasks come from `/users/me`, so a rail or ToS
    // change must refetch the user. Screens that show KYC state refetch it on
    // a KYC status push, but a Bridge endorsement change moves only a rail and
    // sends no status push.
    const userRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const userRefetchInFlightRef = useRef(false)
    const userRefetchQueuedRef = useRef(false)

    const refetchUser = useCallback(async () => {
        if (userRefetchInFlightRef.current) {
            // The request in flight may have read the user before this change,
            // so read once more when it settles instead of starting a second one.
            userRefetchQueuedRef.current = true
            return
        }
        userRefetchInFlightRef.current = true
        try {
            do {
                userRefetchQueuedRef.current = false
                await fetchUser()
            } while (userRefetchQueuedRef.current)
        } finally {
            userRefetchInFlightRef.current = false
        }
    }, [fetchUser])

    const scheduleUserRefetch = useCallback(() => {
        if (userRefetchTimerRef.current) return
        userRefetchTimerRef.current = setTimeout(() => {
            userRefetchTimerRef.current = null
            void refetchUser()
        }, USER_REFETCH_WINDOW_MS)
    }, [refetchUser])

    useEffect(
        () => () => {
            if (userRefetchTimerRef.current) clearTimeout(userRefetchTimerRef.current)
        },
        []
    )

    const handleRailStatusUpdate = useCallback(() => {
        refetchRainOverview()
        scheduleUserRefetch()
    }, [refetchRainOverview, scheduleUserRefetch])

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
        onRailStatusUpdate: handleRailStatusUpdate,
        onTosUpdate: scheduleUserRefetch,
        onRainCardBalanceChanged: handleRainCardBalanceChanged,
    })

    return null
}
