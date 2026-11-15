import { useSyncExternalStore } from 'react'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

/*
 * App loads per user on this device (prefs.sessionCount), counted once per
 * load. The provider counts before its first decision; the push store calls
 * the same function, so a load is never counted twice.
 */
const counted = new Set<string>()
const listeners = new Set<() => void>()

export function countSession(userId: string): void {
    if (counted.has(userId)) return
    counted.add(userId)
    updateUserPreferences(userId, { sessionCount: (getUserPreferences(userId)?.sessionCount ?? 0) + 1 })
    listeners.forEach((listener) => listener())
}

export function useSessionCount(userId: string | null): number {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        () => (userId ? (getUserPreferences(userId)?.sessionCount ?? 0) : 0),
        () => 0
    )
}

export function resetSessionCountForTests(): void {
    counted.clear()
}
