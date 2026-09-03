import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

/**
 * The app-review nudge's friction suppressor.
 *
 * Split out of app-review.ts on purpose: this half is imported by
 * instrumentation-client's `before_send`, which runs before anything else on the
 * page, and must not pull Sentry / Capacitor / user-preferences in behind it.
 */

/** Recent trouble outranks a good moment: don't ask a user we just failed. */
const QUIET_DAYS = 7

const DAY_MS = 86_400_000

/**
 * Device-scoped rather than keyed by userId: the events below fire from screens
 * where no peanut user is resolved (guest claim, a backend error during login).
 */
const FRICTION_KEY = 'peanut:app-review-friction'

/**
 * Analytics events that mean the user just had a bad time. Any of them silences
 * the ask for QUIET_DAYS. This is the honest version of what the old
 * "Could be better" branch was reaching for: suppress the question rather than
 * filter the answer.
 */
const FRICTION_EVENTS = new Set<string>([
    ANALYTICS_EVENTS.SEND_FAILED,
    ANALYTICS_EVENTS.SEND_LINK_FAILED,
    ANALYTICS_EVENTS.CLAIM_LINK_FAILED,
    ANALYTICS_EVENTS.DEPOSIT_FAILED,
    ANALYTICS_EVENTS.WITHDRAW_FAILED,
    ANALYTICS_EVENTS.CARD_APPLY_FAILED,
    ANALYTICS_EVENTS.BACKEND_ERROR_SHOWN,
    ANALYTICS_EVENTS.KYC_REJECTED,
])

/** Call from posthog's `before_send`. Never throws — analytics must not break the app. */
export function noteAppReviewFriction(eventName: string): void {
    if (!FRICTION_EVENTS.has(eventName)) return
    try {
        window.localStorage.setItem(FRICTION_KEY, String(Date.now()))
    } catch {
        // private mode / quota — degrades to asking a user we should have skipped
    }
}

export function hadRecentFriction(): boolean {
    try {
        const at = Number(window.localStorage.getItem(FRICTION_KEY))
        return Number.isFinite(at) && at > 0 && Date.now() - at < QUIET_DAYS * DAY_MS
    } catch {
        return false
    }
}
