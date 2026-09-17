import type { CaptureResult } from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const STORAGE_KEY = 'ph_login_captured_session'

/**
 * Drop duplicate `login` captures within one PostHog session (TASK-22516).
 *
 * The user query refetches on focus and after invalidations, so a per-fetch
 * capture billed login ~8x per session. Dedup runs in `before_send`, keyed on
 * the `$session_id` the capture pipeline assigned — not on `get_session_id()`
 * before capturing, which is read-only: an idle-expired session would return
 * the stale id and suppress the very capture that starts the new session. The
 * marker persists in localStorage so a reload inside the same session does not
 * re-emit. Fails open: no session id or no storage → let the event through.
 */
export function suppressDuplicateLogin(event: CaptureResult | null): CaptureResult | null {
    if (!event || event.event !== ANALYTICS_EVENTS.LOGIN) return event
    const sessionId = event.properties?.$session_id
    if (typeof sessionId !== 'string' || !sessionId) return event
    try {
        if (window.localStorage.getItem(STORAGE_KEY) === sessionId) return null
        window.localStorage.setItem(STORAGE_KEY, sessionId)
    } catch {
        // storage unavailable (private mode etc.) — a duplicate beats a lost login
    }
    return event
}
