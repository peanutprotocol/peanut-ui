import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { REVIEW_URL } from '@/constants/migration.consts'
import { isNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { hadRecentFriction } from '@/utils/app-review-friction'
import { isDemoMode } from '@/utils/demo'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

/**
 * Native app-store review requests.
 *
 * App Store Review Guideline 5.6.1 disallows custom review prompts, so the ask
 * is the OS sheet and nothing else: no pre-question, no "are you enjoying it?",
 * no branch that routes unhappy users somewhere other than the store (5.6.3,
 * and Google's In-App Review guidelines forbid the pre-question by name).
 *
 * The OS returns no signal — not whether the sheet appeared, not whether a
 * rating was left — so the budget below is the only control we have. iOS shows
 * at most 3 prompts per 365 days and may decline silently; Google's quota is
 * undocumented. We stay under Apple's ceiling deliberately: a request spent on
 * a weak moment is a request unavailable for a strong one.
 */

/** Happy moments to bank before the first ask — HIG's "demonstrated engagement". */
const MIN_QUALIFYING_MOMENTS = 2

/** Floor between two requests. Dismissal is never permanent, just expensive. */
const REQUEST_COOLDOWN_DAYS = 120

/** Our own ceiling, one under Apple's 3/365, so a great moment always has budget. */
const MAX_REQUESTS_PER_YEAR = 2

const DAY_MS = 86_400_000

/**
 * Open the store's write-a-review page — the user-initiated "Rate Peanut" row,
 * never a prompt.
 *
 * Deliberately not openExternalUrl: that opens an in-app sheet
 * (SFSafariViewController on iOS), which does not follow universal links, so
 * `?action=write-review` would render the web listing with no composer on it.
 * AppLauncher hands the url to the OS, which opens the App Store / Play app.
 */
export async function openStoreReviewPage(store: 'ios' | 'android'): Promise<void> {
    try {
        const { AppLauncher } = await import('@capacitor/app-launcher')
        // it reports a failed launch in `completed`, it does not throw — an
        // unchecked call is a dead tap with no error anywhere
        const { completed } = await AppLauncher.openUrl({ url: REVIEW_URL[store] })
        if (completed) return
    } catch {
        // plugin missing (web, or a binary predating it) — fall through
    }
    // the in-app sheet still reaches the listing, just without the composer
    await openExternalUrl(REVIEW_URL[store])
}

/** Which happy moment triggered the request — the `trigger` property on the event. */
export type AppReviewTrigger = 'reward_claimed' | 'payment_completed' | 'money_received' | 'qr_payment_completed'

/**
 * Record a happy moment and, if the budget allows, ask the OS for a review.
 *
 * The moment is always banked — the counter is what earns the first ask — but
 * the request itself is rate-limited. Resolves once the flow settles; callers
 * should not await it for anything user-visible.
 */
export async function requestAppReview(userId: string | undefined, trigger: AppReviewTrigger): Promise<void> {
    // isNativeBridge, not isCapacitor: a capacitor-flavoured web preview has the
    // plugin's web adapter, which resolves without showing anything — and would
    // still spend a request from the budget
    if (!userId || !isNativeBridge() || isDemoMode()) return

    const nudge = getUserPreferences(userId)?.reviewNudge
    const moments = (nudge?.moments ?? 0) + 1
    // Bank the moment before any gate below can return: a user who is inside a
    // cooldown still accrues engagement toward the ask on the far side of it.
    const requestedAt = nudge?.requestedAt ?? []
    updateUserPreferences(userId, { reviewNudge: { moments, requestedAt } })

    if (moments < MIN_QUALIFYING_MOMENTS) return
    if (hadRecentFriction()) return

    const now = Date.now()
    const last = requestedAt.length ? Date.parse(requestedAt[requestedAt.length - 1]) : NaN
    const daysSinceLast = Number.isFinite(last) ? Math.floor((now - last) / DAY_MS) : null
    if (daysSinceLast !== null && daysSinceLast < REQUEST_COOLDOWN_DAYS) return
    if (requestedAt.filter((at) => now - Date.parse(at) < 365 * DAY_MS).length >= MAX_REQUESTS_PER_YEAR) return

    try {
        const { CapgoInAppReview } = await import('@capgo/capacitor-in-app-review')
        await CapgoInAppReview.requestReview()
    } catch {
        // Android rejects when the Play review flow can't start (no Play
        // Services, sideloaded build). Nothing to recover, and nothing the user
        // should ever see — but the request must not be recorded as spent.
        return
    }

    // Keep only what the two windows above read.
    const history = [...requestedAt, new Date(now).toISOString()].slice(-MAX_REQUESTS_PER_YEAR - 1)
    updateUserPreferences(userId, { reviewNudge: { moments, requestedAt: history } })

    posthog.capture(ANALYTICS_EVENTS.REVIEW_REQUESTED, {
        trigger,
        request_count: history.length,
        days_since_last: daysSinceLast,
        qualifying_moments: moments,
    })
}
