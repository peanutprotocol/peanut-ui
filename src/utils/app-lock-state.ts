// Module-level lock registry: the one place that knows whether the native app
// lock is currently engaged. Lives outside React because its main consumer is
// auth-token.ts (a plain module), and pulling the Redux store in there would
// create an import cycle. React consumers subscribe via useAppLocked().

import { useSyncExternalStore } from 'react'

export type LockState = 'unlocked' | 'locked'

export const APP_LOCK_CHANGED_EVENT = 'app-lock:changed'

let lockState: LockState = 'unlocked'
const subscribers = new Set<() => void>()

export function getLockState(): LockState {
    return lockState
}

export function setLockState(next: LockState): void {
    if (lockState === next) return
    lockState = next
    subscribers.forEach((cb) => cb())
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(APP_LOCK_CHANGED_EVENT, { detail: next }))
    }
}

export function subscribeLockState(cb: () => void): () => void {
    subscribers.add(cb)
    return () => subscribers.delete(cb)
}

export function useAppLocked(): boolean {
    return useSyncExternalStore(
        subscribeLockState,
        () => lockState === 'locked',
        () => false
    )
}
