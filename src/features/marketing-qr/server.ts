import { MARKETING_QR_EVENT, getMarketingQrRegistration, parseMarketingQrQuery } from './contract'

export const MARKETING_QR_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
}
const BODY_KEYS = new Set([
    'event_id',
    'opened_at',
    'qr_id',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'attribution_origin',
    'attribution_adjustment',
])
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// The installed apps' webview origins (iOS, Android). A QR that opens the app sends its
// opening from there, because no web page loads (sendMarketingQrAppOpening).
const APP_ORIGINS = new Set(['capacitor://localhost', 'https://localhost'])

export function isMarketingQrAppOrigin(origin: string | null): origin is string {
    return origin !== null && APP_ORIGINS.has(origin)
}

export function marketingQrAppCorsHeaders(origin: string): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    }
}

export function isAutomatedMarketingQrRequest(headers: Headers): boolean {
    return (
        /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|embedly|headless/i.test(
            headers.get('user-agent') ?? ''
        ) || /prefetch|prerender/i.test(`${headers.get('purpose') ?? ''} ${headers.get('sec-purpose') ?? ''}`)
    )
}

export function parseMarketingQrOpening(value: unknown, now = Date.now()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const body = value as Record<string, unknown>
    if (Object.keys(body).some((key) => !BODY_KEYS.has(key))) return null
    if (
        typeof body.event_id !== 'string' ||
        !UUID_V4.test(body.event_id) ||
        typeof body.opened_at !== 'string' ||
        typeof body.qr_id !== 'string'
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
    const registration = getMarketingQrRegistration(body.qr_id)
    if (!registration) return null
    if (
        !['current_url', 'saved_campaign', 'placement_default'].includes(String(body.attribution_origin)) ||
        !['none', 'content_trimmed', 'length_fallback'].includes(String(body.attribution_adjustment))
    )
        return null
    const params = new URLSearchParams()
    const keys = {
        utm_source: 's',
        utm_medium: 'm',
        utm_campaign: 'c',
        utm_content: 'n',
        attribution_origin: 'o',
        attribution_adjustment: 'a',
    }
    for (const [field, compact] of Object.entries(keys)) {
        if (body[field] === undefined) continue
        if (typeof body[field] !== 'string') return null
        params.set(compact, body[field] as string)
    }
    const attribution = parseMarketingQrQuery(registration, params)
    if (!attribution.valid) return null
    return { event_id: body.event_id, opened_at: body.opened_at, registration, ...attribution }
}

export type MarketingQrOpening = NonNullable<ReturnType<typeof parseMarketingQrOpening>>

/** Called only from Next's after(): browser navigation never waits for this request. */
export async function captureMarketingQrOpening(
    opening: MarketingQrOpening,
    requestOrigin: string,
    openedIn: 'web' | 'app'
): Promise<void> {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
    if (process.env.VERCEL_ENV !== 'production' || requestOrigin !== 'https://peanut.me' || !key) return
    const { registration, campaign } = opening
    try {
        await fetch('https://eu.i.posthog.com/i/v0/e/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
            body: JSON.stringify({
                api_key: key,
                uuid: opening.event_id,
                timestamp: opening.opened_at,
                event: MARKETING_QR_EVENT,
                distinct_id: `marketing-qr:${opening.event_id}`,
                properties: {
                    schema_version: 1,
                    qr_id: registration.qr_id,
                    page_id: registration.page_id,
                    surface_type: registration.surface_type,
                    placement: registration.placement,
                    locale: registration.locale,
                    destination_key: registration.destination_key,
                    utm_source: campaign.source,
                    utm_medium: campaign.medium,
                    utm_campaign: campaign.campaign,
                    ...(campaign.content ? { utm_content: campaign.content } : {}),
                    attribution_origin: opening.attributionOrigin,
                    attribution_adjustment: opening.attributionAdjustment,
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

/** Enforce the byte limit even when Content-Length is absent or misleading. */
export async function readMarketingQrBody(request: Request): Promise<{ status: number; value?: unknown }> {
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        return { status: 400 }
    if (Number(request.headers.get('content-length')) > 1024) return { status: 413 }
    const reader = request.body?.getReader()
    if (!reader) return { status: 400 }
    const chunks: Uint8Array[] = []
    let length = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            length += value.byteLength
            if (length > 1024) {
                await reader.cancel()
                return { status: 413 }
            }
            chunks.push(value)
        }
        const bytes = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.length
        }
        return { status: 200, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
    } catch {
        return { status: 400 }
    }
}
