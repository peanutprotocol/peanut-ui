'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/redux/hooks'
import { loadSeenCodes, persistSeenCodes, pickCelebrationBadges, type CelebrationBadge } from './badgeCelebration.utils'

type UseBadgeEarnToast = {
    /** Freshly-earned, not-yet-seen, non-excluded badges (newest first). */
    pending: CelebrationBadge[]
    /** Mark these codes seen so they don't toast again (per-user localStorage). */
    markSeen: (codes: string[]) => void
}

/**
 * Detects freshly-earned, un-surfaced badges from the signed-in user's badge
 * list (from /users/me via the redux user store) for the badge-earn toast.
 * Persistence is a per-user localStorage seen-set + a freshness window — see
 * badgeCelebration.utils.ts for the why.
 */
export function useBadgeEarnToast(): UseBadgeEarnToast {
    const { user } = useUserStore()
    const userId = user?.user?.userId
    const badges = user?.user?.badges

    // Hydrated from localStorage; re-hydrated when the signed-in user changes
    // (logout → a different account on the same device).
    const [seen, setSeen] = useState<Set<string>>(() => (userId ? loadSeenCodes(userId) : new Set()))
    useEffect(() => {
        setSeen(userId ? loadSeenCodes(userId) : new Set())
    }, [userId])

    const pending = useMemo(() => {
        if (!userId) return []
        return pickCelebrationBadges(badges, seen, Date.now())
    }, [userId, badges, seen])

    const markSeen = useCallback(
        (codes: string[]) => {
            if (!userId || codes.length === 0) return
            setSeen((prev) => {
                const next = new Set(prev)
                codes.forEach((c) => next.add(c))
                persistSeenCodes(userId, next)
                return next
            })
        },
        [userId]
    )

    return { pending, markSeen }
}
