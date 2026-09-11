/**
 * The one event that tells notification consumers (the support unread badge)
 * to re-read server state. Server truth stays with the unread endpoint —
 * dispatching only says "recheck now". Every dispatch site goes through these
 * helpers so the sites can never disagree on the event name.
 */
export const NOTIFICATIONS_UPDATED_EVENT = 'notifications:updated'

export function notifyNotificationsUpdated() {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT))
}

/**
 * The backend dispatcher writes the in-app unread row in parallel with the
 * push send (peanut-api-ts src/notifications/dispatcher.ts), so a push that
 * reaches an already-foregrounded app can trigger the recheck before the row
 * commits — the badge would read zero and, with no later lifecycle edge, stay
 * off. One more recheck after a grace period closes that race.
 */
const UNREAD_ROW_COMMIT_GRACE_MS = 2_500

let pendingRecheck: ReturnType<typeof setTimeout> | undefined

/** Refresh consumers for a push delivered to an already-foregrounded app/tab. */
export function onForegroundPushDelivered() {
    notifyNotificationsUpdated()
    clearTimeout(pendingRecheck)
    pendingRecheck = setTimeout(notifyNotificationsUpdated, UNREAD_ROW_COMMIT_GRACE_MS)
}
