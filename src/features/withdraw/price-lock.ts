import { type WithdrawPriceLock } from '@/services/manteca'

/** A Manteca price lock with the moment it expires on this device's clock. */
export type ReceivedPriceLock = WithdrawPriceLock & {
    /** Device-clock deadline, or undefined when the API sent no remaining time. */
    deadline?: number
}

/**
 * Stamps a price lock with its deadline on this device's clock. The API's
 * `expiresAt` is Manteca's clock: compared with a phone that runs a few minutes
 * fast, every lock looked expired and each attempt re-quoted. The deadline
 * comes from the remaining time the API measured (`expiresInMs`) and the
 * moment the answer arrived. Without that field there is no deadline, and the
 * provider rejects an expired lock on submit, as it did before TASK-23054.
 */
export function receivePriceLock(lock: WithdrawPriceLock, receivedAt: number = Date.now()): ReceivedPriceLock {
    const remaining = lock.expiresInMs
    const deadline = typeof remaining === 'number' && Number.isFinite(remaining) ? receivedAt + remaining : undefined
    return { ...lock, deadline }
}

/** True once the lock's device-clock deadline has passed. */
export function isPriceLockExpired(lock: ReceivedPriceLock, now: number = Date.now()): boolean {
    return lock.deadline !== undefined && now >= lock.deadline
}
