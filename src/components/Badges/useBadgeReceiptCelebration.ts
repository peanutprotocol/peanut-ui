'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/redux/hooks'
import {
    loadSeenCodes,
    persistSeenCodes,
    pickCelebrationBadge,
    type CelebrationBadge,
} from '@/components/Badges/badgeCelebration.utils'

type UseBadgeReceiptCelebration = {
    /** The badge whose fullscreen celebration should show now, or null. */
    pending: CelebrationBadge | null
    /** Mark the current pending badge celebrated (stamps the per-user seen-set). */
    dismiss: () => void
}

/**
 * Detects a freshly-earned, not-yet-celebrated badge from the signed-in user's
 * badge list (sourced from /users/me via the redux user store) and exposes it
 * for a one-time fullscreen celebration. Persistence is a per-user localStorage
 * seen-set + a freshness window — see badgeCelebration.utils.ts for the why.
 */
export function useBadgeReceiptCelebration(): UseBadgeReceiptCelebration {
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
        if (!userId) return null
        return pickCelebrationBadge(badges, seen, Date.now())
    }, [userId, badges, seen])

    const dismiss = useCallback(() => {
        if (!userId || !pending) return
        const code = pending.code
        setSeen((prev) => {
            const next = new Set(prev)
            next.add(code)
            persistSeenCodes(userId, next)
            return next
        })
    }, [userId, pending])

    return { pending, dismiss }
}
