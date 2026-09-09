'use client'

import { useCallback, useMemo, useState } from 'react'
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

    // `seen` is derived SYNCHRONOUSLY from storage. The previous
    // useState(initial) + useEffect(re-hydrate) lagged one render behind the
    // async user load: on the render where `userId` first became defined, the
    // seen-set was still empty, so `pending` included already-seen badges and
    // the toast re-fired on every cold start until the badge aged out. Reading
    // in useMemo keyed on userId closes that gap; `bump` re-reads after markSeen
    // persists.
    const [bump, setBump] = useState(0)
    // `bump` is a deliberate recompute trigger — markSeen() bumps it after
    // persisting so `seen` re-reads storage. It isn't used inside the callback,
    // which exhaustive-deps can't distinguish from a stray dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const seen = useMemo(() => (userId ? loadSeenCodes(userId) : new Set<string>()), [userId, bump])

    const pending = useMemo(() => {
        if (!userId) return []
        return pickCelebrationBadges(badges, seen, Date.now())
    }, [userId, badges, seen])

    const markSeen = useCallback(
        (codes: string[]) => {
            if (!userId || codes.length === 0) return
            const next = new Set(loadSeenCodes(userId))
            codes.forEach((c) => next.add(c))
            persistSeenCodes(userId, next)
            setBump((b) => b + 1)
        },
        [userId]
    )

    return { pending, markSeen }
}
