/**
 * Local fallback for the residence declared at signup.
 *
 * The server copy (userDetails via /update-user, read back on /users/me) is
 * the durable record; this mirror only bridges the gaps where the server
 * value isn't available yet — the write hasn't landed, the API predates the
 * residence fields, or /users/me hasn't refetched. Readers must always
 * prefer the server value.
 *
 * Keys are scoped per account: localStorage is shared across every login on
 * the device, and an unscoped key would let a second account inherit the
 * previous account's country (wrong residence display, wrong "Your region").
 */
const keyFor = (userId: string) => `peanut:declaredResidence:${userId}`

/** Pre-scoping key. Not attributable to an account, so it is only ever removed. */
const LEGACY_KEY = 'peanut:declaredResidence'

export function storeDeclaredResidence(userId: string | undefined, iso2: string): void {
    if (!userId) return
    try {
        window.localStorage.setItem(keyFor(userId), iso2.toUpperCase())
        window.localStorage.removeItem(LEGACY_KEY)
    } catch {
        // storage unavailable (private mode, blocked) — the server copy stands
    }
}

export function readDeclaredResidence(userId: string | undefined): string | null {
    if (!userId) return null
    try {
        // Drop, never migrate, the unscoped value: it may belong to a
        // different account that used this device.
        window.localStorage.removeItem(LEGACY_KEY)
        const value = window.localStorage.getItem(keyFor(userId))
        return value && /^[A-Z]{2}$/.test(value) ? value : null
    } catch {
        return null
    }
}
