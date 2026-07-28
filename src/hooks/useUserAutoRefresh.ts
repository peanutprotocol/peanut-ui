'use client'

import { useEffect, useRef } from 'react'
import { useSubmissionWindow, isInSubmissionWindow } from '@/hooks/useSubmissionWindow'
import type { IUserProfile } from '@/interfaces/interfaces'

/**
 * Singleton auto-refresh poller for the `[USER]` query. Mount EXACTLY ONCE
 * from {@link AuthProvider} — never from a per-component hook like
 * {@link useCapabilities}, since `useCapabilities` is consumed by N components
 * and would spawn N parallel intervals (with React-Query coalescing limiting
 * the actual HTTP fanout to 1, but the interval timers, listeners, and in-flight
 * guard are still per-instance — a CodeRabbit MAJOR finding on the original
 * landing of `useSubmissionWindow`).
 *
 * Polls every {@link POLL_INTERVAL_MS} while either:
 *   - any rail is `status === 'pending'` (BE-provisioned rail not yet settled), OR
 *   - a post-submission window is active (recent Sumsub/ToS/etc. write —
 *     see {@link useSubmissionWindow}).
 *
 * Self-terminates the moment both predicates are false. The interval callback
 * re-reads the latest predicate from a ref + the module-level submission flag,
 * so the effect itself doesn't re-create when those change.
 */

const POLL_INTERVAL_MS = 4000

export function useUserAutoRefresh({
    user,
    fetchUser,
}: {
    user: IUserProfile | null | undefined
    fetchUser: () => Promise<unknown>
}): void {
    // Subscribe to the submission window so the effect re-runs when it flips.
    // `isInWindow` is also read imperatively from inside the interval body
    // (so the loop can self-terminate the tick after the window expires).
    const { isInWindow } = useSubmissionWindow()

    const hasPendingRail = user?.capabilities?.rails?.some((rail) => rail.status === 'pending') ?? false
    const shouldPoll = hasPendingRail || isInWindow

    // Latest predicate in a ref so the interval body can re-evaluate without
    // restarting the timer.
    const hasPendingRailRef = useRef(hasPendingRail)
    hasPendingRailRef.current = hasPendingRail

    // Prevent overlapping fetches: if one round-trip is slower than
    // POLL_INTERVAL_MS, the next tick would stack a second on top.
    const inFlightRef = useRef(false)

    useEffect(() => {
        if (!shouldPoll) return

        let cancelled = false
        const timer = setInterval(() => {
            if (cancelled) return
            if (!hasPendingRailRef.current && !isInSubmissionWindow()) {
                clearInterval(timer)
                return
            }
            if (inFlightRef.current) return
            inFlightRef.current = true
            fetchUser()
                .catch(() => {
                    // Errors surface via the user query itself — swallow here purely
                    // so the interval body doesn't throw unhandled rejections.
                })
                .finally(() => {
                    inFlightRef.current = false
                })
        }, POLL_INTERVAL_MS)

        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [shouldPoll, fetchUser])
}
