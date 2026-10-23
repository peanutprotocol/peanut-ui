import { SUPPORTED_LOCALES } from '@/i18n/types'
import { LEGAL_POLICIES } from '@/constants/legal-policies'
import publicAttributionPaths from '@/constants/signup-attribution-paths.generated.json'
import { getFromCookie, saveToCookie } from './cookie-url.utils'
import posthog from 'posthog-js'
import { isAnalyticsCaptureBuild, posthogProjectKey } from './posthog-setup'

export const SIGNUP_ATTRIBUTION_COOKIE = 'signupAttribution'
export const SIGNUP_ATTRIBUTION_SCHEMA_VERSION = '1'
const SIGNUP_ATTRIBUTION_EXPIRY_DAYS = 90
const MAX_VALUE_LENGTH = 128
const MAX_PATH_LENGTH = 512
const MAX_SERIALIZED_ATTRIBUTION_LENGTH = 4096
// Browser limits vary around 4 KiB and some count cookie attributes too.
// Keep the percent-encoded name/value below 3.8 KiB so expiry, path,
// SameSite, and Secure attributes still fit without silent eviction.
const MAX_ATTRIBUTION_COOKIE_NAME_VALUE_LENGTH = 3800
const NATIVE_STORAGE_KEY = 'signup-attribution'
const PENDING_SIGNUP_KEY = 'signup-attribution-pending'
const MAX_TOUCH_AGE_MS = 180 * 24 * 60 * 60 * 1000
const MAX_TOUCH_FUTURE_MS = 24 * 60 * 60 * 1000
const MARKETING_VALUE_PATTERN = /^[A-Za-z0-9][-A-Za-z0-9 ._~+]*$/
const UUID_VALUE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WALLET_VALUE_PATTERN = /^0x[0-9a-f]{40}$/i
const IPV4_VALUE_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
// Keep old serialized journeys readable when their article has since been retired.
// New browser captures use the exact sitemap inventory below.
const LEGACY_PUBLIC_PATH_PATTERN =
    /^\/(?:$|(?:[a-z]{2}(?:-[a-z0-9]{2,8})?\/)?(?:blog|content|help|faq|how-it-works|pay-with|send-money-to|receive-money-from)(?:\/[a-z0-9][a-z0-9/_-]*)?|(?:signup|setup|home))$/i
const PUBLIC_PATHS = new Set([...publicAttributionPaths, ...SUPPORTED_LOCALES.map((locale) => `/${locale}`)])
const REGISTRATION_PATHS = new Set(['/signup', '/setup', '/home'])
const PUBLIC_SLUG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const IDENTIFIER_SEGMENT_PATTERN =
    /(?:^|-)(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|0x[0-9a-f]{40})(?:-|$)/i

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

// Native bundles can predate an article or outlive its publication. Match the
// API's bounded public families when reading a journey, while browser capture
// still requires the exact inventory built with the page.
function isSerializedPublicPath(pathname: string): boolean {
    if (isLegacyAttributionPath(pathname)) return true
    const [, locale, ...segments] = pathname.split('/')
    if (!pathname.startsWith('/') || !SUPPORTED_LOCALES.some((supported) => supported === locale)) return false
    if (segments.some((segment) => !PUBLIC_SLUG_PATTERN.test(segment) || IDENTIFIER_SEGMENT_PATTERN.test(segment))) {
        return false
    }
    const [family, slug] = segments
    if (segments.length === 2) {
        if (family === 'stories' || family === 'use-cases' || family === 'withdraw') return true
        if (family === 'compare') return /^peanut-vs-[a-z]/.test(slug)
        if (family === 'deposit') return /^(?:from|via)-[a-z]/.test(slug)
    }
    return segments.length === 4 && family === 'send-money-from' && segments[2] === 'to'
}

/** Older native decoders reject the whole journey if their path field is unfamiliar. */
export function isLegacyAttributionPath(pathname: string): boolean {
    return LEGACY_PUBLIC_PATH_PATTERN.test(pathname)
}

function cleanPath(path: string, capture = false): string | undefined {
    const clean = cleanValue(path, MAX_PATH_LENGTH)?.split(/[?#]/, 1)[0]
    if (!clean || clean.includes('..') || clean.includes('%')) return undefined
    if (PUBLIC_PATHS.has(clean) || REGISTRATION_PATHS.has(clean)) return clean
    return !capture && isSerializedPublicPath(clean) ? clean : undefined
}

function newJourneyId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
        const random = Math.random() * 16
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return Math.floor(value).toString(16)
    })
}

function platform(): SignupAttributionPlatform {
    if (typeof window === 'undefined') return 'unknown'
    return process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true'
        ? 'web'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'ios'
          : 'android'
}

/** Content classification also decodes older store handoffs that omitted duplicate touches. */
export function isContentAttributionPath(path: string): boolean {
    const pathname = cleanPath(path)
    if (!pathname) return false
    if (REGISTRATION_PATHS.has(pathname) || pathname === '/' || pathname === '/careers') return false
    const parts = pathname.split('/').filter(Boolean)
    const hasLocale = SUPPORTED_LOCALES.some((locale) => parts[0] === locale)
    if (hasLocale && parts.length === 1) return false
    const contentPath = hasLocale ? `/${parts.slice(1).join('/')}` : pathname
    return !LEGAL_POLICIES.some(({ href }) => href.replace(/^\/en(?=\/)/, '') === contentPath)
}

function currentTouch(includeDocumentReferrer: boolean): SignupAttributionTouch | null {
    if (typeof window === 'undefined') return null

    const url = new URL(window.location.href)
    // document.referrer describes the initial document request and stays
    // unchanged across App Router navigations. Reusing it would turn every
    // later path into a fabricated external last touch.
    const referrer = includeDocumentReferrer ? document.referrer : ''
    let referrerHost: string | undefined
    if (referrer) {
        try {
            const parsedReferrer = new URL(referrer)
            if (parsedReferrer.origin !== url.origin) referrerHost = cleanHost(parsedReferrer.hostname)
        } catch {}
    }

    return {
        occurredAt: new Date().toISOString(),
        utmSource: cleanMarketingValue(url.searchParams.get('utm_source')),
        utmMedium: cleanMarketingValue(url.searchParams.get('utm_medium')),
        utmCampaign: cleanMarketingValue(url.searchParams.get('utm_campaign')),
        utmContent: cleanMarketingValue(url.searchParams.get('utm_content')),
        referrerHost,
        path: cleanPath(url.pathname, true),
    }
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
        (touch.path !== undefined && typeof touch.path !== 'string')
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

/** Rebuild from allowlisted fields and trim lower-priority touches to the API and cookie caps. */
function canonicalSignupAttribution(value: unknown): SignupAttributionContext | null {
    if (!isContext(value)) return null
    // An older native inventory may not recognize a new country hub. Drop
    // that path, not the known campaign and journey. An unknown content touch
    // must not prevent a later recognized article from becoming the first one.
    const firstContentTouch =
        value.firstContentTouch &&
        (value.firstContentTouch.path === undefined || cleanPath(value.firstContentTouch.path))
            ? canonicalTouch(value.firstContentTouch)
            : undefined
    const canonical: SignupAttributionContext = {
        schemaVersion: SIGNUP_ATTRIBUTION_SCHEMA_VERSION,
        journeyId: value.journeyId,
        platform: value.platform,
        analyticsState: 'enabled',
        captureMethod: value.captureMethod,
        firstTouch: canonicalTouch(value.firstTouch),
        ...(firstContentTouch ? { firstContentTouch } : {}),
        ...(value.lastTouch ? { lastTouch: canonicalTouch(value.lastTouch) } : {}),
    }
    const candidates: SignupAttributionContext[] = [
        canonical,
        { ...canonical, lastTouch: undefined },
        { ...canonical, firstContentTouch: undefined, lastTouch: undefined },
    ]
    return candidates.find(fitsAttributionStorage) ?? null
}

export function readSignupAttribution(): SignupAttributionContext | null {
    if (!analyticsCollectionAvailable()) {
        void clearSignupAttribution()
        return null
    }
    const rawStored = getFromCookie(SIGNUP_ATTRIBUTION_COOKIE)
    const stored = canonicalSignupAttribution(rawStored)
    if (rawStored && !stored) void clearSignupAttribution()
    return stored
}

export function captureSignupAttribution({
    includeDocumentReferrer = false,
}: { includeDocumentReferrer?: boolean } = {}): SignupAttributionContext | null {
    if (!analyticsCollectionAvailable()) return null
    const touch = currentTouch(includeDocumentReferrer)
    if (!touch) return null

    const existing = readSignupAttribution()
    const context: SignupAttributionContext = {
        schemaVersion: SIGNUP_ATTRIBUTION_SCHEMA_VERSION,
        journeyId: existing?.journeyId ?? newJourneyId(),
        platform: existing?.platform ?? platform(),
        analyticsState: 'enabled',
        captureMethod: existing?.captureMethod ?? 'browser',
        firstTouch: existing?.firstTouch ?? touch,
        ...(existing?.firstContentTouch
            ? { firstContentTouch: existing.firstContentTouch }
            : touch.path && isContentAttributionPath(touch.path)
              ? { firstContentTouch: touch }
              : {}),
        ...(touch.utmSource || touch.utmMedium || touch.utmCampaign || touch.utmContent || touch.referrerHost
            ? { lastTouch: touch }
            : existing?.lastTouch
              ? { lastTouch: existing.lastTouch }
              : {}),
    }

    const bounded = canonicalSignupAttribution(context)
    if (!bounded) return null
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, bounded, SIGNUP_ATTRIBUTION_EXPIRY_DAYS)
    return bounded
}

export function restoreSignupAttribution(context: SignupAttributionContext): SignupAttributionContext {
    if (!analyticsCollectionAvailable()) return context
    const existing = readSignupAttribution()
    const restored = canonicalSignupAttribution({
        ...context,
        captureMethod: 'deferred_link',
        firstContentTouch: context.firstContentTouch ?? existing?.firstContentTouch,
        lastTouch: context.lastTouch ?? existing?.lastTouch,
    })
    if (!restored) return context
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, restored, SIGNUP_ATTRIBUTION_EXPIRY_DAYS)
    void persistNativeSignupAttribution(restored)
    return restored
}

function readPendingSignupAttributionUserIdLocally(): string | null {
    try {
        return localStorage.getItem(PENDING_SIGNUP_KEY)
    } catch {
        return null
    }
}

function clearPendingSignupAttributionLocally(expectedUserId?: string): void {
    try {
        if (expectedUserId && localStorage.getItem(PENDING_SIGNUP_KEY) !== expectedUserId) return
        localStorage.removeItem(PENDING_SIGNUP_KEY)
    } catch {}
}

async function removeNativeSignupKeys(keys: string[]): Promise<void> {
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true') return
    try {
        const { Preferences } = await import('@capacitor/preferences')
        await Promise.all(keys.map((key) => Preferences.remove({ key })))
    } catch {}
}

export async function clearSignupAttribution(): Promise<void> {
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, '', -1)
    clearPendingSignupAttributionLocally()
    await removeNativeSignupKeys([PENDING_SIGNUP_KEY, NATIVE_STORAGE_KEY])
}

/** Bind a completed passkey ceremony to the account eligible to attach it. */
export async function markSignupAttributionPending(userId: string): Promise<void> {
    try {
        localStorage.setItem(PENDING_SIGNUP_KEY, userId)
    } catch {}
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true') {
        try {
            const { Preferences } = await import('@capacitor/preferences')
            await Preferences.set({ key: PENDING_SIGNUP_KEY, value: userId })
        } catch {}
    }
}

export async function clearPendingSignupAttribution(expectedUserId?: string): Promise<void> {
    clearPendingSignupAttributionLocally(expectedUserId)
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true') return
    try {
        const { Preferences } = await import('@capacitor/preferences')
        if (expectedUserId && (await Preferences.get({ key: PENDING_SIGNUP_KEY })).value !== expectedUserId) return
        await Preferences.remove({ key: PENDING_SIGNUP_KEY })
    } catch {}
}

/** Only a client that just completed registration may finalize a journey. */
export async function hasPendingSignupAttribution(userId: string): Promise<boolean> {
    const localUserId = readPendingSignupAttributionUserIdLocally()
    if (localUserId !== null) return localUserId === userId
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true') return false
    try {
        const { Preferences } = await import('@capacitor/preferences')
        return (await Preferences.get({ key: PENDING_SIGNUP_KEY })).value === userId
    } catch {
        return false
    }
}

export function signupAnalyticsState(): 'enabled' | 'disabled' | 'unknown' {
    // Jest exercises the capture contract without a public build key.
    if (process.env.NODE_ENV === 'test') return 'enabled'
    if (!posthogProjectKey()) return 'unknown'
    // A non-production build opts out of capture by environment, not because
    // the user declined analytics: keep the attribution journey so staging can
    // QA it. It reaches the staging API only, never PostHog.
    if (!isAnalyticsCaptureBuild()) return 'enabled'
    try {
        if (typeof posthog.has_opted_out_capturing !== 'function') return 'unknown'
        return posthog.has_opted_out_capturing() ? 'disabled' : 'enabled'
    } catch {
        return 'unknown'
    }
}

function analyticsCollectionAvailable(): boolean {
    return signupAnalyticsState() === 'enabled'
}

async function persistNativeSignupAttribution(context: SignupAttributionContext): Promise<void> {
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true') return
    const serialized = serializeSignupAttribution(context)
    if (!serialized) return
    try {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.set({ key: NATIVE_STORAGE_KEY, value: serialized })
    } catch {}
}

/** Persist the context before a native app can be killed between restore and signup. */
export async function persistSignupAttribution(context: SignupAttributionContext): Promise<void> {
    const bounded = canonicalSignupAttribution(context)
    if (!bounded) {
        await clearSignupAttribution()
        return
    }
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, bounded, SIGNUP_ATTRIBUTION_EXPIRY_DAYS)
    await persistNativeSignupAttribution(bounded)
}

/** Cookie first, then native Preferences for WebView restarts. */
export async function readSignupAttributionAsync(): Promise<SignupAttributionContext | null> {
    const cookieContext = readSignupAttribution()
    if (cookieContext) return cookieContext
    if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD !== 'true' || !analyticsCollectionAvailable()) return null
    try {
        const { Preferences } = await import('@capacitor/preferences')
        const stored = await Preferences.get({ key: NATIVE_STORAGE_KEY })
        const parsed = parseSignupAttribution(stored.value)
        if (stored.value && !parsed) await clearSignupAttribution()
        return parsed
    } catch {
        return null
    }
}

/**
 * Ensure a registration has a durable attribution journey before its passkey
 * ceremony starts. Deferred-link restoration runs first on native; a direct
 * install falls back to a first-party browser touch for the current /setup
 * route. Persisting the result in Preferences lets a killed WebView finish the
 * authenticated attachment after restart.
 */
export async function ensureSignupAttributionForRegistration(): Promise<SignupAttributionContext | null> {
    if (!analyticsCollectionAvailable()) {
        await clearSignupAttribution()
        return null
    }

    const context = (await readSignupAttributionAsync()) ?? captureSignupAttribution()
    if (!context) return null

    await persistSignupAttribution(context)
    return context
}

export function serializeSignupAttribution(
    context: SignupAttributionContext | null = readSignupAttribution()
): string | null {
    const canonical = canonicalSignupAttribution(context)
    return canonical ? JSON.stringify(canonical) : null
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

export function buildSignupAttributionHeader(): string | undefined {
    const context = readSignupAttribution() ?? captureSignupAttribution()
    return serializeSignupAttribution(context) ?? undefined
}

export function signupAttributionPosthogProperties(
    context: SignupAttributionContext | null = readSignupAttribution()
): Record<string, string> {
    if (!context) return {}
    return {
        signup_journey_id: context.journeyId,
        signup_platform: context.platform,
        signup_attribution_capture_method: context.captureMethod,
    }
}
