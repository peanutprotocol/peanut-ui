import { useSyncExternalStore } from 'react'

/*
 * Some journey inputs live outside React (the stored post-auth redirect in
 * localStorage). A surface that consumes one bumps the epoch so the state
 * is rebuilt, or the manager would re-pick the ask it just settled.
 */
const listeners = new Set<() => void>()
let epoch = 0

export function bumpJourneyEpoch(): void {
    epoch++
    listeners.forEach((listener) => listener())
}

export function useJourneyEpoch(): number {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        () => epoch,
        () => 0
    )
}
