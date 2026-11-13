import { isAnalyticsCaptureBuild } from '@/utils/posthog-setup'
import type { SignupAttributionContext } from '@/utils/signup-attribution'
import { isAcquisitionSlug, TRACKED_LINK_EVENT, TRACKED_LINK_ORIGIN } from './contract'

const KEYS = new Set(['event_id', 'opened_at', 'slug', 'signup_journey_id'])
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Matches the native router's duplicate-link window.
const REPLAY_WINDOW_MS = 3000
const observed = new Map<string, number>()

/**
 * A journey exists only when strict tracked-link consent allowed it, so it doubles as the
 * consent gate. React effect replays of one opening reuse the first; a later opening of the
 * same link in a long-lived app webview counts again.
 */
export function captureTrackedLinkVisit(
    slug: string,
    { openedIn, seen, journey }: { openedIn: 'web' | 'app'; seen: boolean; journey: SignupAttributionContext | null }
): void {
    // Journeys fall back when randomUUID is missing (older webviews); a throw here would cost the handoff.
    if (seen || !journey || !isAnalyticsCaptureBuild() || typeof crypto.randomUUID !== 'function') return
    const now = Date.now()
    if (now - (observed.get(slug) ?? -Infinity) < REPLAY_WINDOW_MS) return
    observed.set(slug, now)
    // No keepalive in the app: some webviews reject a keepalive request that needs a CORS preflight.
    void fetch(`${openedIn === 'app' ? TRACKED_LINK_ORIGIN : ''}/api/tracked-links/open`, {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        keepalive: openedIn === 'web',
        body: JSON.stringify({
            event_id: crypto.randomUUID(),
            opened_at: new Date().toISOString(),
            slug,
            signup_journey_id: journey.journeyId,
        }),
    }).catch(() => {})
}

export type TrackedLinkOpening = NonNullable<ReturnType<typeof parseTrackedLinkOpening>>

export function parseTrackedLinkOpening(value: unknown, now = Date.now()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    if (
        Object.keys(body).some((key) => !KEYS.has(key)) ||
        typeof body.event_id !== 'string' ||
        !UUID_V4.test(body.event_id) ||
        typeof body.signup_journey_id !== 'string' ||
        !UUID.test(body.signup_journey_id) ||
        typeof body.opened_at !== 'string' ||
        !isAcquisitionSlug(body.slug)
    )
        return null
    const timestamp = Date.parse(body.opened_at)
    if (
        !Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString() !== body.opened_at ||
        timestamp < now - 300_000 ||
        timestamp > now + 60_000
    )
        return null
    return {
        event_id: body.event_id,
        opened_at: body.opened_at,
        slug: body.slug,
        signup_journey_id: body.signup_journey_id,
    }
}

/** Called only from Next's after(): browser navigation never waits for this request. */
export async function captureTrackedLinkOpening(
    opening: TrackedLinkOpening,
    linkId: string,
    requestOrigin: string,
    openedIn: 'web' | 'app'
): Promise<void> {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    if (process.env.VERCEL_ENV !== 'production' || requestOrigin !== TRACKED_LINK_ORIGIN || !key) return
    try {
        await fetch('https://eu.i.posthog.com/i/v0/e/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
            body: JSON.stringify({
                api_key: key,
                uuid: opening.event_id,
                timestamp: opening.opened_at,
                event: TRACKED_LINK_EVENT,
                distinct_id: `tracked-link:${opening.event_id}`,
                properties: {
                    schema_version: 1,
                    link_id: linkId,
                    signup_journey_id: opening.signup_journey_id,
                    opened_in: openedIn,
                    $process_person_profile: false,
                    $geoip_disable: true,
                },
            }),
        })
    } catch {
        // Best-effort, without retaining visitor data or creating a retry queue.
    }
}
