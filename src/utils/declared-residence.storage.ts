/**
 * Local fallback for the residence declared at signup.
 *
 * The server copy (userDetails via /update-user, read back on /users/me) is
 * the durable record; this mirror only bridges the gaps where the server
 * value isn't available yet — the write hasn't landed, the API predates the
 * residence fields, or /users/me hasn't refetched. Readers must always
 * prefer the server value.
 */
const KEY = 'peanut:declaredResidence'

export function storeDeclaredResidence(iso2: string): void {
    try {
        window.localStorage.setItem(KEY, iso2.toUpperCase())
    } catch {
        // storage unavailable (private mode, blocked) — the server copy stands
    }
}

export function readDeclaredResidence(): string | null {
    try {
        const value = window.localStorage.getItem(KEY)
        return value && /^[A-Z]{2}$/.test(value) ? value : null
    } catch {
        return null
    }
}
