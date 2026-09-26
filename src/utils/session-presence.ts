/**
 * Whether THIS TAB has an unconsumed authenticated session marker.
 *
 * It separates the two reasons the app can find itself logged out on a
 * protected route: someone arrived at a deep link they cannot have yet (their
 * own intent — worth returning them to after auth), or a session that was
 * standing here collapsed (logout, revocation, expiry — where it happened to
 * be standing is nobody's intent, and belongs to an account that is not
 * necessarily the next one to authenticate here).
 *
 * sessionStorage, not a React ref: the marker has to survive a reload of the
 * same tab. An authenticated tab that reloads after its token expired never
 * observes a user in the new document, and a ref would read that as a
 * first-time visitor — handing the previous session's page to the next
 * account. It is per-tab by design, so a second tab answers for itself.
 *
 * Storage can be unavailable (private mode, blocked site data), in which case
 * this reports no session. The stored destination it qualifies lives in
 * localStorage, which is unavailable in exactly the same conditions, so there
 * is nothing left to qualify.
 */
const SESSION_PRESENCE_KEY = 'had-session'

export function markSessionHeld(): void {
    try {
        sessionStorage.setItem(SESSION_PRESENCE_KEY, '1')
    } catch {
        // storage unavailable — see the note above
    }
}

export function hasHeldSession(): boolean {
    try {
        return sessionStorage.getItem(SESSION_PRESENCE_KEY) === '1'
    } catch {
        return false
    }
}

/**
 * Called when the session ends deliberately or after the auth gate has
 * observed the first passive session collapse: this tab is a logged-out tab
 * again, so a later deep link opened in it is that person's own intent.
 */
export function clearSessionHeld(): void {
    try {
        sessionStorage.removeItem(SESSION_PRESENCE_KEY)
    } catch {
        // storage unavailable — see the note above
    }
}

/**
 * Consume the marker when the auth gate records the first unauthenticated
 * bounce after a session collapse. The current route is session residue; a
 * later protected route in this same tab is a new visitor intent.
 */
export function consumeHeldSession(): boolean {
    if (!hasHeldSession()) return false
    clearSessionHeld()
    return true
}
