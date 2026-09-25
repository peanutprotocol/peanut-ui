'use client'

import { useQuery } from '@tanstack/react-query'
import { rainApi, type RainCardOverview } from '@/services/rain'
import { useAuth } from '@/context/authContext'

export const RAIN_CARD_OVERVIEW_QUERY_KEY = 'rain-card-overview'

/**
 * Fetches the composite Rain card state (application status, collateral
 * balance, issued cards) for the authenticated user.
 *
 * Polls every 30s and refetches on window focus. `SocketQueryRefresh`, mounted
 * once for the app, invalidates it on `user_rail_status_changed` (rail
 * transitions) and `rain_card_balance_changed` (card txns, auto-balancer
 * deposits, collateral deployment). This hook opens no socket listener of its
 * own: it has dozens of consumers, and one listener each multiplied every
 * event into as many refetches.
 */
export const useRainCardOverview = () => {
    const { user } = useAuth()
    const userId = user?.user?.userId

    const query = useQuery<RainCardOverview>({
        queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY, userId],
        queryFn: () => rainApi.getOverview(),
        enabled: !!userId,
        staleTime: 30_000,
        // Only users who actually have a card application have anything here
        // that moves on its own. Polling every logged-in user every 30s made
        // this the single most-called endpoint and, with it, the top source of
        // client-side 10s timeouts (PEANUT-UI-QD5) — for a payload that reads
        // `hasApplication: false` every time. Card users keep the 30s cadence;
        // everyone else refetches on focus, and the `user_rail_status_changed`
        // invalidation from SocketQueryRefresh resumes polling the moment they apply.
        refetchInterval: (query) => (query.state.data?.status?.hasApplication === false ? false : 30_000),
        refetchOnWindowFocus: true,
        retry: 1,
    })

    return {
        overview: query.data,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
    }
}
