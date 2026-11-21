/**
 * The account-deleted notice outlives the session. Since api#2227 the API answers a deleted
 * account's open session with 401, so a /users/me refetch (window focus, app resume) can end the
 * session while the Settings "done" step is open and send the user to /setup. The landing then
 * shows the account-deleted callout from this flag instead of a blank log-in screen.
 */
const KEY = 'peanut:accountDeletedNotice'

export function markAccountDeleted(): void {
    try {
        sessionStorage.setItem(KEY, '1')
    } catch {}
}

export function readAccountDeletedNotice(): boolean {
    try {
        return sessionStorage.getItem(KEY) === '1'
    } catch {
        return false
    }
}

export function clearAccountDeletedNotice(): void {
    try {
        sessionStorage.removeItem(KEY)
    } catch {}
}
