// Module-level lock registry: the one place that knows whether the native app
// lock is currently engaged. Lives outside React because its main consumer is
// auth-token.ts (a plain module reachable from Server Component graphs), so no
// React imports here — React consumers subscribe via the useAppLocked hook
// (src/hooks/useAppLocked.ts).

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
