'use client'

import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import posthog from 'posthog-js'
import { useCallback, useSyncExternalStore } from 'react'

// balance visibility is a persistent user preference (localStorage), not
// ephemeral ui state — so it lives in a tiny external store instead of a
// useState. useSyncExternalStore keeps the flow hook state-free and every
// subscriber (balance display, activity amounts) in sync.
const listeners = new Set<() => void>()

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
        () => (userId ? (getUserPreferences(userId)?.balanceHidden ?? false) : false),
        () => false
    )

    const toggleBalanceVisibility = useCallback(() => {
        if (!userId) return
        const next = !(getUserPreferences(userId)?.balanceHidden ?? false)
        posthog.capture(ANALYTICS_EVENTS.BALANCE_VISIBILITY_TOGGLED, { is_hidden: next })
        updateUserPreferences(userId, { balanceHidden: next })
        notify()
    }, [userId])

    return { isBalanceHidden, toggleBalanceVisibility }
}
