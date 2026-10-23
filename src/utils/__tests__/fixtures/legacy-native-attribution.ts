// Frozen native attribution decoder from peanut-ui 89e0a7bf043014410e14efa505f3051c2a6bcd81.
// The same source shipped on dev 7635e217. Function bodies are copied unchanged
// from signup-attribution.ts and deferred-link.ts; do not update with the new codec.
// This fixture must reject paths that old installed apps cannot understand.
import { badgeCampaignIdentitiesFromDeferredSearchParams } from '@/components/Invites/badge-campaign-context'
import type { DeferredPayload } from '../../deferred-link'

export const SIGNUP_ATTRIBUTION_COOKIE = 'signupAttribution'

export const SIGNUP_ATTRIBUTION_SCHEMA_VERSION = '1'

const MAX_VALUE_LENGTH = 128

const MAX_PATH_LENGTH = 512

const MAX_SERIALIZED_ATTRIBUTION_LENGTH = 4096

const MAX_ATTRIBUTION_COOKIE_NAME_VALUE_LENGTH = 3800

const MAX_TOUCH_AGE_MS = 180 * 24 * 60 * 60 * 1000

const MAX_TOUCH_FUTURE_MS = 24 * 60 * 60 * 1000

const MARKETING_VALUE_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9 ._~+]*$/

const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const WALLET_VALUE_PATTERN = /^0x[0-9a-f]{40}$/i

const IPV4_VALUE_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/

const PUBLIC_PATH_PATTERN =
    /^\/(?:$|(?:[a-z]{2}(?:-[a-z0-9]{2,8})?\/)?(?:blog|content|help|faq|how-it-works|pay-with|send-money-to|receive-money-from)(?:\/[a-z0-9][a-z0-9/_-]*)?|(?:signup|setup|home))$/i

export type SignupAttributionPlatform = 'web' | 'ios' | 'android' | 'unknown'

export type SignupAttributionCaptureMethod = 'browser' | 'deferred_link'

export interface SignupAttributionTouch {
    occurredAt: string
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
    utmContent?: string
    referrerHost?: string
    path?: string
}

export interface SignupAttributionContext {
    schemaVersion: typeof SIGNUP_ATTRIBUTION_SCHEMA_VERSION
    journeyId: string
    platform: SignupAttributionPlatform
    analyticsState: 'enabled'
    captureMethod: SignupAttributionCaptureMethod
    firstTouch: SignupAttributionTouch
    firstContentTouch?: SignupAttributionTouch
    lastTouch?: SignupAttributionTouch
}

function cleanValue(value: string | null | undefined, maxLength = MAX_VALUE_LENGTH): string | undefined {
    if (!value) return undefined
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : undefined
}

function cleanMarketingValue(value: string | null | undefined): string | undefined {
    const cleaned = cleanValue(value)
    if (
        !cleaned ||
        !MARKETING_VALUE_PATTERN.test(cleaned) ||
        cleaned.includes('@') ||
        cleaned.includes('://') ||
        cleaned.toLowerCase().startsWith('www.') ||
        UUID_VALUE_PATTERN.test(cleaned) ||
        WALLET_VALUE_PATTERN.test(cleaned)
    )
        return undefined
    return cleaned
}

function cleanHost(value: string | null | undefined): string | undefined {
    const cleaned = cleanValue(value, 255)?.toLowerCase()
    if (!cleaned || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/.test(cleaned)) return undefined
    const hostname = cleaned.replace(/:\d{1,5}$/, '')
    if (UUID_VALUE_PATTERN.test(hostname) || WALLET_VALUE_PATTERN.test(hostname) || IPV4_VALUE_PATTERN.test(hostname)) {
        return undefined
    }
    return cleaned
}

function cleanPath(path: string): string | undefined {
    const clean = cleanValue(path, MAX_PATH_LENGTH)?.split(/[?#]/, 1)[0]
    return clean && PUBLIC_PATH_PATTERN.test(clean) && !clean.includes('..') && !clean.includes('%') ? clean : undefined
}

function isTouch(value: unknown): value is SignupAttributionTouch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const touch = value as Partial<SignupAttributionTouch>
    const occurredAt = new Date(touch.occurredAt ?? '').getTime()
    const now = Date.now()
    if (
        !Number.isFinite(occurredAt) ||
        occurredAt < now - MAX_TOUCH_AGE_MS ||
        occurredAt > now + MAX_TOUCH_FUTURE_MS ||
        (touch.utmSource !== undefined && !cleanMarketingValue(touch.utmSource)) ||
        (touch.utmMedium !== undefined && !cleanMarketingValue(touch.utmMedium)) ||
        (touch.utmCampaign !== undefined && !cleanMarketingValue(touch.utmCampaign)) ||
        (touch.utmContent !== undefined && !cleanMarketingValue(touch.utmContent)) ||
        (touch.referrerHost !== undefined && !cleanHost(touch.referrerHost)) ||
        (touch.path !== undefined && !cleanPath(touch.path))
    )
        return false
    return Object.keys(touch).every((key) =>
        ['occurredAt', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'referrerHost', 'path'].includes(key)
    )
}

function isContext(value: unknown): value is SignupAttributionContext {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const context = value as Partial<SignupAttributionContext>
    return (
        Object.keys(context).every((key) =>
            [
                'schemaVersion',
                'journeyId',
                'platform',
                'analyticsState',
                'captureMethod',
                'firstTouch',
                'firstContentTouch',
                'lastTouch',
            ].includes(key)
        ) &&
        context.schemaVersion === SIGNUP_ATTRIBUTION_SCHEMA_VERSION &&
        typeof context.journeyId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.journeyId) &&
        (context.platform === 'web' ||
            context.platform === 'ios' ||
            context.platform === 'android' ||
            context.platform === 'unknown') &&
        context.analyticsState === 'enabled' &&
        (context.captureMethod === 'browser' || context.captureMethod === 'deferred_link') &&
        isTouch(context.firstTouch) &&
        (context.firstContentTouch === undefined || isTouch(context.firstContentTouch)) &&
        (context.lastTouch === undefined || isTouch(context.lastTouch))
    )
}

function canonicalTouch(touch: SignupAttributionTouch): SignupAttributionTouch {
    return {
        occurredAt: new Date(touch.occurredAt).toISOString(),
        ...(cleanMarketingValue(touch.utmSource) ? { utmSource: cleanMarketingValue(touch.utmSource) } : {}),
        ...(cleanMarketingValue(touch.utmMedium) ? { utmMedium: cleanMarketingValue(touch.utmMedium) } : {}),
        ...(cleanMarketingValue(touch.utmCampaign) ? { utmCampaign: cleanMarketingValue(touch.utmCampaign) } : {}),
        ...(cleanMarketingValue(touch.utmContent) ? { utmContent: cleanMarketingValue(touch.utmContent) } : {}),
        ...(cleanHost(touch.referrerHost) ? { referrerHost: cleanHost(touch.referrerHost) } : {}),
        ...(touch.path && cleanPath(touch.path) ? { path: cleanPath(touch.path) } : {}),
    }
}

function fitsAttributionStorage(candidate: SignupAttributionContext): boolean {
    const serialized = JSON.stringify(candidate)
    return (
        serialized.length <= MAX_SERIALIZED_ATTRIBUTION_LENGTH &&
        `${SIGNUP_ATTRIBUTION_COOKIE}=${encodeURIComponent(serialized)}`.length <=
            MAX_ATTRIBUTION_COOKIE_NAME_VALUE_LENGTH
    )
}

function canonicalSignupAttribution(value: unknown): SignupAttributionContext | null {
    if (!isContext(value)) return null
    const canonical: SignupAttributionContext = {
        schemaVersion: SIGNUP_ATTRIBUTION_SCHEMA_VERSION,
        journeyId: value.journeyId,
        platform: value.platform,
        analyticsState: 'enabled',
        captureMethod: value.captureMethod,
        firstTouch: canonicalTouch(value.firstTouch),
        ...(value.firstContentTouch ? { firstContentTouch: canonicalTouch(value.firstContentTouch) } : {}),
        ...(value.lastTouch ? { lastTouch: canonicalTouch(value.lastTouch) } : {}),
    }
    const candidates: SignupAttributionContext[] = [
        canonical,
        { ...canonical, lastTouch: undefined },
        { ...canonical, firstContentTouch: undefined, lastTouch: undefined },
    ]
    return candidates.find(fitsAttributionStorage) ?? null
}

export function parseSignupAttribution(value: string | null | undefined): SignupAttributionContext | null {
    if (!value || value.length > MAX_SERIALIZED_ATTRIBUTION_LENGTH) return null
    try {
        const parsed: unknown = JSON.parse(value)
        return canonicalSignupAttribution(parsed)
    } catch {
        return null
    }
}

const MARKER = 'pnutdl'

const ATTRIBUTION_PARAM = 'at'

type CompactTouch = {
    t: number
    s?: string
    m?: string
    c?: string
    n?: string
    r?: string
    p?: string
}

type CompactAttribution = {
    v: 1
    j: string
    p: SignupAttributionContext['platform']
    f: CompactTouch
    c?: CompactTouch
    l?: CompactTouch
}

function expandTouch(touch: CompactTouch): SignupAttributionContext['firstTouch'] | null {
    if (!Number.isFinite(touch.t)) return null
    return {
        occurredAt: new Date(touch.t).toISOString(),
        ...(touch.s ? { utmSource: touch.s } : {}),
        ...(touch.m ? { utmMedium: touch.m } : {}),
        ...(touch.c ? { utmCampaign: touch.c } : {}),
        ...(touch.n ? { utmContent: touch.n } : {}),
        ...(touch.r ? { referrerHost: touch.r } : {}),
        ...(touch.p ? { path: touch.p } : {}),
    }
}

function base64UrlDecode(value: string): string {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
    return atob(padded)
}

function parseAttributionHandoff(value: string | null): SignupAttributionContext | null {
    if (!value) return null
    try {
        const compact = JSON.parse(base64UrlDecode(value)) as Partial<CompactAttribution>
        if (compact.v !== 1 || typeof compact.j !== 'string' || !compact.f) return null
        const firstTouch = expandTouch(compact.f)
        if (!firstTouch) return null
        const firstContentTouch = compact.c ? expandTouch(compact.c) : null
        const lastTouch = compact.l ? expandTouch(compact.l) : null
        const context: SignupAttributionContext = {
            schemaVersion: '1',
            journeyId: compact.j,
            platform: compact.p ?? 'unknown',
            analyticsState: 'enabled',
            captureMethod: 'deferred_link',
            firstTouch,
            ...(firstContentTouch ? { firstContentTouch } : {}),
            ...(lastTouch ? { lastTouch } : {}),
        }
        return parseSignupAttribution(JSON.stringify(context))
    } catch {
        return null
    }
}

export function parseDeferredPayload(raw: string): DeferredPayload | null {
    const qIndex = raw.indexOf('?')
    const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : raw
    let params: URLSearchParams
    try {
        params = new URLSearchParams(qs)
    } catch {
        return null
    }
    if (params.get(MARKER) !== '1') return null
    const pick = (key: string) => params.get(key) || undefined
    const badgeCampaigns = badgeCampaignIdentitiesFromDeferredSearchParams(params)
    const attribution =
        parseAttributionHandoff(params.get(ATTRIBUTION_PARAM)) ?? parseSignupAttribution(params.get('attribution'))
    return {
        lang: pick('lang'),
        invite: pick('invite'),
        badgeCampaigns: badgeCampaigns.length > 0 ? badgeCampaigns : undefined,
        attribution: attribution ?? undefined,
        dest: pick('dest'),
    }
}
