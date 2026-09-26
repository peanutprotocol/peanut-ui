/** A Manteca lock (withdraw price lock or QR payment lock) with the moment it expires on this device's clock. */
export type ReceivedLock<T> = T & {
    /** Device-clock deadline, or undefined when the API sent no remaining time. */
    deadline?: number
}

/**
 * Stamps a Manteca lock with its deadline on this device's clock. The lock's
 * own expiry is Manteca's clock: compared with a phone that runs a few minutes
 * fast, every lock looked expired and each attempt re-quoted. The deadline
 * comes from the remaining time our API measured (`expiresInMs`, api#1707)
 * and the moment the answer arrived. Without that field there is no deadline,
 * and the provider rejects an expired lock on submit.
 */
export function receiveLock<T extends { expiresInMs?: number }>(
    lock: T,
    receivedAt: number = Date.now()
): ReceivedLock<T> {
    const remaining = lock.expiresInMs
    const deadline = typeof remaining === 'number' && Number.isFinite(remaining) ? receivedAt + remaining : undefined
    return { ...lock, deadline }
}

/** True once the lock's device-clock deadline has passed. */
export function isLockExpired(lock: { deadline?: number }, now: number = Date.now()): boolean {
    return lock.deadline !== undefined && now >= lock.deadline
}
