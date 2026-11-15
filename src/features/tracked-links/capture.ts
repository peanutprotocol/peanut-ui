import { isAnalyticsCaptureBuild } from '@/utils/posthog-setup'
import type { SignupAttributionContext } from '@/utils/signup-attribution'
import { cleanReferrerHost } from '@/utils/attribution-values'
import {
    type GoPageVariant,
    type GoVisit,
    isAcquisitionSlug,
    isGoPageLabel,
    parseGoVisitParams,
    TRACKED_LINK_EVENT,
    TRACKED_LINK_ORIGIN,
} from './contract'

const KEYS = new Set([
    'event_id',
    'opened_at',
    'slug',
    'signup_journey_id',
    'placement',
    'code',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'referrer_host',
    'page_variant',
    'page_experiment',
])
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
    {
        openedIn,
        seen,
        journey,
        visit,
        page,
    }: {
        openedIn: 'web' | 'app'
        seen: boolean
        journey: SignupAttributionContext | null
        visit?: GoVisit | null
        page?: GoPageVariant | null
    }
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
            placement: visit?.placement ?? null,
            code: visit?.code ?? null,
            utm_source: visit?.utm.source ?? null,
            utm_medium: visit?.utm.medium ?? null,
            utm_campaign: visit?.utm.campaign ?? null,
            utm_content: visit?.utm.content ?? null,
            referrer_host: visit?.referrerHost ?? null,
            page_variant: page?.variant ?? null,
            page_experiment: page?.experimentId ?? null,
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
        ...parseLabels(body),
    }
}

/** Labels can be forged and only describe the visit, so a bad one becomes null instead of losing the event. */
function parseLabels(body: Record<string, unknown>) {
    const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string) : '')
    const params = new URLSearchParams({ tl: body.slug as string })
    if (typeof body.placement === 'string') params.set('tl_s', body.placement)
    else if (Number.isInteger(body.code)) params.set('tl_s', String(body.code))
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) params.set(key, text(key))
    // The contract's rules, so the event and the handoff agree on what a valid label is.
    const visit = parseGoVisitParams(params)!
    const page = (key: string) => (isGoPageLabel(text(key)) ? text(key) : null)
    return {
        placement: visit.placement,
        code: typeof body.placement === 'string' ? null : visit.code,
        utm_source: visit.utm.source,
        utm_medium: visit.utm.medium,
        utm_campaign: visit.utm.campaign,
        utm_content: visit.utm.content,
        referrer_host: cleanReferrerHost(text('referrer_host')) ?? null,
        page_variant: page('page_variant'),
        page_experiment: page('page_experiment'),
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
                    schema_version: 2,
                    link_id: linkId,
                    signup_journey_id: opening.signup_journey_id,
                    opened_in: openedIn,
                    placement: opening.placement,
                    code: opening.code,
                    utm_source: opening.utm_source,
                    utm_medium: opening.utm_medium,
                    utm_campaign: opening.utm_campaign,
                    utm_content: opening.utm_content,
                    referrer_host: opening.referrer_host,
                    page_variant: opening.page_variant,
                    page_experiment: opening.page_experiment,
                    $process_person_profile: false,
                    $geoip_disable: true,
                },
            }),
        })
    } catch {
        // Best-effort, without retaining visitor data or creating a retry queue.
    }
}
