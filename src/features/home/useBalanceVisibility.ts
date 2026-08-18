'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { useCallback, useSyncExternalStore } from 'react'

// balance visibility is a persistent user preference (localStorage), not
// ephemeral ui state — so it lives in a tiny external store instead of a
// useState. the in-memory map is the source of truth for the session
// (hydrated from the preference once per user), so the toggle keeps working
// even when localStorage writes fail (safari private mode / quota), and
// getSnapshot costs a map lookup instead of a localStorage read per render.
// ponytail: writes that bypass this hook (updateUserPreferences directly)
// won't notify subscribers — move notification into updateUserPreferences if
// a second writer ever appears.
const cache = new Map<string, boolean>()
const listeners = new Set<() => void>()

const readHidden = (userId: string): boolean => {
    if (!cache.has(userId)) {
        cache.set(userId, getUserPreferences(userId)?.balanceHidden ?? false)
    }
    return cache.get(userId)!
}

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

const notify = () => listeners.forEach((listener) => listener())

export function useBalanceVisibility(userId: string | undefined) {
    const isBalanceHidden = useSyncExternalStore(
        subscribe,
        () => (userId ? readHidden(userId) : false),
        () => false
    )

    const toggleBalanceVisibility = useCallback(() => {
        if (!userId) return
        const next = !readHidden(userId)
        cache.set(userId, next)
        // best-effort persistence — the in-memory value drives this session
        updateUserPreferences(userId, { balanceHidden: next })
        posthog.capture(ANALYTICS_EVENTS.BALANCE_VISIBILITY_TOGGLED, { is_hidden: next })
        notify()
    }, [userId])

    return { isBalanceHidden, toggleBalanceVisibility }
}
