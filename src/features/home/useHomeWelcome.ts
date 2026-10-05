'use client'

import { getUserPreferences, updateUserPreferences, type UserPreferences } from '@/utils/general.utils'
import { useEffect, useRef, useState } from 'react'

const WELCOME_LIFETIME_MS = 24 * 60 * 60 * 1000
const WELCOME_VISIT_LIMIT = 5
type WelcomeState = NonNullable<UserPreferences['homeWelcome']>

/** The greeting expires independently of the checklist, per user on this device. */
export function useHomeWelcome(userId: string | undefined, isPageLoading: boolean, hasProgress: boolean) {
    const visitRef = useRef<{ userId: string; state: WelcomeState }>()
    const [visibility, setVisibility] = useState<{ userId: string; show: boolean }>()

    useEffect(() => {
        if (!userId || isPageLoading) return

        const now = Date.now()
        // One visit per Home mount, including React's repeated effect setup.
        const previousVisit = visitRef.current
        let state: WelcomeState
        if (previousVisit?.userId === userId) {
            state = previousVisit.state
        } else {
            const stored = getUserPreferences(userId)?.homeWelcome
            state = {
                firstSeenAt: stored?.firstSeenAt ?? now,
                visits: Math.min((stored?.visits ?? 0) + 1, WELCOME_VISIT_LIMIT),
                hidden: stored?.hidden ?? false,
            }
        }

        state = {
            ...state,
            hidden:
                state.hidden ||
                hasProgress ||
                state.visits >= WELCOME_VISIT_LIMIT ||
                now - state.firstSeenAt >= WELCOME_LIFETIME_MS,
        }

        const save = (next: WelcomeState) => {
            visitRef.current = { userId, state: next }
            updateUserPreferences(userId, { homeWelcome: next })
            setVisibility({ userId, show: !next.hidden })
        }
        save(state)
        if (state.hidden) return

        // Also expires if the user leaves Home open across the 24-hour mark.
        const timer = setTimeout(() => save({ ...state, hidden: true }), state.firstSeenAt + WELCOME_LIFETIME_MS - now)
        return () => clearTimeout(timer)
    }, [userId, isPageLoading, hasProgress])

    return !isPageLoading && !hasProgress && visibility?.userId === userId && visibility?.show === true
}
