const prefix = 'eurc-signed-operation:'
const signedOperations = new Map<string, unknown>()
const inFlight = new Set<string>()
const listeners = new Set<() => void>()
const sessions = new Map<string, number>()

const keyFor = (userId: string, operationId: string) => `${prefix}${userId}:${operationId}`
const notify = () => listeners.forEach((listener) => listener())

export function subscribeCurrencyOperation(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export const currencyOperationInFlight = (userId: string, operationId: string) =>
    inFlight.has(keyFor(userId, operationId))
export const currencyOperationSession = (userId: string) => sessions.get(userId) ?? 0

export function invalidateCurrencyOperationSession(userId: string) {
    sessions.set(userId, currencyOperationSession(userId) + 1)
}

export function assertCurrencyOperationSession(userId: string, version: number) {
    if (currencyOperationSession(userId) !== version) throw new Error('Currency account session changed')
}

export function readSignedCurrencyOperation(userId: string, operationId: string): unknown | null {
    const key = keyFor(userId, operationId)
    if (signedOperations.has(key)) return signedOperations.get(key)
    try {
        const stored = localStorage.getItem(key)
        if (stored === null) return null
        const record = JSON.parse(stored)
        if (!record || typeof record.operation !== 'object' || !record.operation) return null
        signedOperations.set(key, record.operation)
        return record.operation
    } catch {
        return null
    }
}

export function storeSignedCurrencyOperation(userId: string, operationId: string, operation: unknown) {
    const key = keyFor(userId, operationId)
    signedOperations.set(key, operation)
    try {
        localStorage.setItem(key, JSON.stringify({ operation }))
    } catch {
        // Device storage is best effort; the in-memory copy still prevents a second signature this session.
    }
}

export function clearSignedCurrencyOperation(userId: string, operationId: string) {
    signedOperations.delete(keyFor(userId, operationId))
    try {
        localStorage.removeItem(keyFor(userId, operationId))
    } catch {
        // A stale device record is harmless: the server probe runs before any reuse.
    }
}

export function clearUserCurrencyOperations(userId: string | undefined) {
    if (!userId) return
    invalidateCurrencyOperationSession(userId)
    const userPrefix = `${prefix}${userId}:`
    for (const key of signedOperations.keys()) if (key.startsWith(userPrefix)) signedOperations.delete(key)
    try {
        const keys = Object.keys(localStorage).filter((key) => key.startsWith(userPrefix))
        for (const key of keys) localStorage.removeItem(key)
    } catch {
        // Logout must still clear authentication when device storage is unavailable.
    }
}

export async function guardCurrencyOperation<T>(userId: string, operationId: string, work: () => Promise<T>) {
    const key = keyFor(userId, operationId)
    if (inFlight.has(key)) return
    inFlight.add(key)
    notify()
    try {
        return await work()
    } finally {
        inFlight.delete(key)
        notify()
    }
}
