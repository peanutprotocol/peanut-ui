import { useSyncExternalStore } from 'react'

/**
 * Users the API refused Avenia's first use this session (its rollout gate, or a
 * verification Avenia cannot start yet). They keep the Manteca flow until the
 * app restarts. Module-scoped, like the submission window: no provider needed.
 */
const unavailableUsers = new Set<string>()
const listeners = new Set<() => void>()

export function markAveniaUnavailable(userId: string): void {
    if (unavailableUsers.has(userId)) return
    unavailableUsers.add(userId)
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function useAveniaUnavailable(userId: string | undefined): boolean {
    return useSyncExternalStore(
        subscribe,
        () => (userId ? unavailableUsers.has(userId) : false),
        () => false
    )
}

/** Test-only reset of the module cell. */
export function __resetAveniaAvailabilityForTests(): void {
    unavailableUsers.clear()
    listeners.clear()
}
