'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { TRANSACTIONS, USER } from '@/constants/query.consts'
import type { RainCardBalanceChangedData } from '@/services/websocket'

// One webhook can move several rails, and each moved rail is its own push, all
// within milliseconds. Pushes inside this window share one GET /users/me.
const USER_REFRESH_WINDOW_MS = 500

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

    // The Home card and Profile tasks come from `/users/me`, so a rail or ToS
    // change must refetch the user. Screens that show KYC state refetch it on
    // a KYC status push, but a Bridge endorsement change moves only a rail and
    // sends no status push.
    const userRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const scheduleUserRefresh = useCallback(() => {
        if (userRefreshTimerRef.current) return
        userRefreshTimerRef.current = setTimeout(() => {
            userRefreshTimerRef.current = null
            // Default cancelRefetch, as above: a read already in flight is
            // restarted. While the app lock disables the user query, this only
            // marks it stale, and it refetches on unlock.
            queryClient.invalidateQueries({ queryKey: [USER] })
            refetchRainOverview()
        }, USER_REFRESH_WINDOW_MS)
    }, [queryClient, refetchRainOverview])

    // A window opened for one session must not refetch after logout or an
    // account switch.
    useEffect(
        () => () => {
            if (userRefreshTimerRef.current) clearTimeout(userRefreshTimerRef.current)
            userRefreshTimerRef.current = null
        },
        [userId]
    )

    const handleRainCardBalanceChanged = useCallback(
        (_data: RainCardBalanceChangedData) => {
            refetchRainOverview()
            // Rain pulls every card payment out of the smart account, so a card
            // event moves the wallet balance too. Refresh both so the spendable
            // sum doesn't wait for useBalance's next 30s poll.
            queryClient.invalidateQueries({ queryKey: ['balance'] })
        },
        [refetchRainOverview, queryClient]
    )

    useWebSocket({
        username: user?.user?.username ?? undefined,
        autoConnect: !!userId,
        onRefetchRequested: refetchHistoryAndBalance,
        onRailStatusUpdate: scheduleUserRefresh,
        onTosUpdate: scheduleUserRefresh,
        onRainCardBalanceChanged: handleRainCardBalanceChanged,
    })

    return null
}
