'use client'

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { rainApi, type CardFundingStop, type RainCardFunding } from '@/services/rain'

/** Shared with `useRainFunding`: one entry per user. */
export const RAIN_CARD_FUNDING_QUERY_KEY = 'rain-card-funding'
export const newStopAttemptId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const POLL_MS = 3_000
const POLL_WINDOW_MS = 60_000

/** One lock/cancel response whose wallet stop is not confirmed yet, for the user and wallet it ran for. */
export interface StopAttempt {
    attemptId: string
    userId?: string
    wallet?: string
    stop: CardFundingStop
}

/**
 * The wallet-wide payment stop (`management.stop`) from the funding read.
 * With `attempt` it reads under a key of its own: no cached or shared answer
 * exists for a new attempt, and another account's or an older request lands
 * elsewhere. Without it, it follows the user's shared read. Polls for about a
 * minute, then waits for `check`. Mount with `key={attempt.id}` to restart the window.
 */
export const useCardStopConfirmation = ({
    enabled,
    attempt,
}: {
    enabled: boolean
    attempt?: { id: string; wallet?: string }
}) => {
    const userId = useAuth().user?.user?.userId
    const startedAt = useRef(Date.now())

    const query = useQuery<RainCardFunding>({
        queryKey: attempt
            ? ['card-stop-attempt', userId, attempt.wallet, attempt.id]
            : [RAIN_CARD_FUNDING_QUERY_KEY, userId],
        queryFn: () => rainApi.getCardFunding(),
        enabled: enabled && !!userId,
        retry: false,
        staleTime: attempt ? 0 : 30_000,
        gcTime: attempt ? 0 : undefined,
        refetchInterval: (q) => {
            if (Date.now() - startedAt.current >= POLL_WINDOW_MS) return false
            const { data } = q.state
            // An attempt keeps asking until it has an answer; the shared read only follows a pending stop.
            return (
                attempt
                    ? !data || data.management.stop?.state === 'pending'
                    : data?.management.stop?.state === 'pending'
            )
                ? POLL_MS
                : false
        },
    })

    const sameWallet = !attempt?.wallet || attempt.wallet.toLowerCase() === query.data?.walletAddress?.toLowerCase()
    const answered = !!query.data && sameWallet
    const stop = (answered && query.data?.management.stop) || null
    return {
        stop,
        /** A matching read came back; `stop: null` then means no stop, which still claims nothing about zero. */
        answered,
        unreadable: !answered && query.isError,
        check: () => void query.refetch(),
    }
}
