'use client'

import { useEffect, useRef } from 'react'
import { requestAppReview, type AppReviewTrigger } from '@/utils/app-review'

/**
 * Delay before the ask, so the success screen's own celebration (sound,
 * confetti, the number the user came to see) plays out first. The OS sheet
 * arrives at a stopping point rather than on top of the moment.
 */
const SETTLE_MS = 2_500

/**
 * Ask for an app-store review on the tail of a happy moment.
 *
 * Mount this on a success surface, gated on the success actually being
 * confirmed (`enabled`). Fires at most once per mount, and only if the surface
 * is still on screen when the timer lands — a user who navigated away is no
 * longer at a stopping point.
 *
 * Takes `userId` rather than reading the store, so it stays free of any
 * provider/redux dependency and can mount on any success surface.
 *
 * Every other constraint (native-only, engagement floor, cooldown, recent
 * friction) lives in requestAppReview, so call sites stay one line.
 */
export function useAppReviewNudge(userId: string | undefined, trigger: AppReviewTrigger, enabled: boolean): void {
    const fired = useRef(false)

    useEffect(() => {
        if (!enabled || !userId || fired.current) return
        const timer = setTimeout(() => {
            fired.current = true
            void requestAppReview(userId, trigger)
        }, SETTLE_MS)
        return () => clearTimeout(timer)
    }, [enabled, userId, trigger])
}
