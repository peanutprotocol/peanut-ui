import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

/**
 * A deposit the add-money drawer saw but has not yet seen settle, kept in session storage so closing and
 * reopening the drawer keeps holding it (TASK-25169, Chip review of b09c28f and c2344fb). It holds the
 * user's own deposit address, the balance the deposit must rise above and, once the balance rose before
 * the provider said completed, what rose: no personal data, never in the URL.
 */
export type DepositLanding = {
    from: number
    /** what reached the balance while the provider still said the deposit was on its way */
    rose: number | null
    at: number
}

/** a landing older than this is no longer trusted as a hold: the balance read decides alone again */
export const DEPOSIT_LANDING_TTL_MS = 60 * 60 * 1000

// the card prefix stays: a new key would drop the hold of a user mid-deposit
const key = (userId: string, address: string) => `card_deposit_landing_v1:${userId}:${address.toLowerCase()}`

export function readDepositLanding(userId: string | undefined, address: string, now = Date.now()) {
    if (!userId) return null
    try {
        const stored = JSON.parse(readStoredValue(key(userId, address), 'sessionStorage') ?? 'null')
        if (typeof stored?.from !== 'number' || typeof stored?.at !== 'number') return null
        if (now - stored.at >= DEPOSIT_LANDING_TTL_MS) return null
        return { from: stored.from, rose: typeof stored.rose === 'number' ? stored.rose : null, at: stored.at }
    } catch {
        return null
    }
}

const write = (userId: string, address: string, landing: DepositLanding) =>
    writeStoredValue(key(userId, address), JSON.stringify(landing), 'sessionStorage')

/** keeps the first record for an address: the oldest baseline is the one the deposit must rise above */
export function rememberDepositLanding(userId: string | undefined, address: string, from: number, now = Date.now()) {
    if (!userId || readDepositLanding(userId, address, now)) return
    write(userId, address, { from, rose: null, at: now })
}

/**
 * The balance rose while the provider still said the deposit was on its way: kept until the provider
 * reports completed, so a reopen reconciles that completion with what already rose instead of holding it.
 */
export function rememberEarlyLanding(
    userId: string | undefined,
    address: string,
    landing: { from: number; rose: number },
    now = Date.now()
) {
    if (userId) write(userId, address, { ...landing, at: now })
}

export function forgetDepositLanding(userId: string | undefined, address: string) {
    if (userId) removeStoredValue(key(userId, address), 'sessionStorage')
}
