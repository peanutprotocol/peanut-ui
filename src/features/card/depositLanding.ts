import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * A deposit the card drawer saw but has not yet seen land, kept in session storage so closing and
 * reopening the drawer keeps holding it (TASK-25169, Chip review of b09c28f). It holds the user's own
 * deposit address and the balance the deposit must rise above: no personal data, never in the URL.
 */
export type DepositLanding = { from: number; amount: number | null; at: number }

/** a landing older than this is no longer trusted as a hold: the balance read decides alone again */
export const DEPOSIT_LANDING_TTL_MS = 60 * 60 * 1000

const key = (userId: string, address: string) => `card_deposit_landing_v1:${userId}:${address.toLowerCase()}`

export function readDepositLanding(userId: string | undefined, address: string, now = Date.now()) {
    if (!userId) return null
    try {
        const stored = JSON.parse(readStoredValue(key(userId, address), 'sessionStorage') ?? 'null')
        if (typeof stored?.from !== 'number' || typeof stored?.at !== 'number') return null
        return now - stored.at < DEPOSIT_LANDING_TTL_MS ? (stored as DepositLanding) : null
    } catch {
        return null
    }
}

/** keeps the first record for an address: the oldest baseline is the one the deposit must rise above */
export function rememberDepositLanding(
    userId: string | undefined,
    address: string,
    landing: { from: number; amount: number | null },
    now = Date.now()
) {
    if (!userId || readDepositLanding(userId, address, now)) return
    writeStoredValue(key(userId, address), JSON.stringify({ ...landing, at: now }), 'sessionStorage')
}

export function forgetDepositLanding(userId: string | undefined, address: string) {
    if (userId) removeStoredValue(key(userId, address), 'sessionStorage')
}
