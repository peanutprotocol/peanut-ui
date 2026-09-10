import { isMarketingRoute } from './marketing-routes'
import { getFromCookie, saveToCookie } from './cookie-url.utils'

export const SIGNUP_ATTRIBUTION_COOKIE = 'signupAttribution'
export const SIGNUP_ATTRIBUTION_SCHEMA_VERSION = '1'
const SIGNUP_ATTRIBUTION_EXPIRY_DAYS = 90
const MAX_VALUE_LENGTH = 128
const MAX_PATH_LENGTH = 512

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

function cleanPath(path: string): string | undefined {
    const clean = cleanValue(path, MAX_PATH_LENGTH)?.split(/[?#]/, 1)[0]
    return clean?.startsWith('/') && !clean.startsWith('//') ? clean : undefined
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

function isContentPath(pathname: string): boolean {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return false
    if (isMarketingRoute(pathname)) return parts.length > 1
    return [
        'blog',
        'content',
        'help',
        'faq',
        'how-it-works',
        'pay-with',
        'send-money-to',
        'receive-money-from',
    ].includes(parts[0].toLowerCase())
}

function currentTouch(): SignupAttributionTouch | null {
    if (typeof window === 'undefined') return null

    const url = new URL(window.location.href)
    const referrer = document.referrer
    let referrerHost: string | undefined
    if (referrer) {
        try {
            const parsedReferrer = new URL(referrer)
            if (parsedReferrer.origin !== url.origin) referrerHost = cleanValue(parsedReferrer.hostname, 255)
        } catch {}
    }

    return {
        occurredAt: new Date().toISOString(),
        utmSource: cleanValue(url.searchParams.get('utm_source')),
        utmMedium: cleanValue(url.searchParams.get('utm_medium')),
        utmCampaign: cleanValue(url.searchParams.get('utm_campaign')),
        utmContent: cleanValue(url.searchParams.get('utm_content')),
        referrerHost,
        path: cleanPath(url.pathname),
    }
}

function isTouch(value: unknown): value is SignupAttributionTouch {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const touch = value as Partial<SignupAttributionTouch>
    return (
        typeof touch.occurredAt === 'string' &&
        new Date(touch.occurredAt).getTime() === new Date(touch.occurredAt).getTime()
    )
}

function isContext(value: unknown): value is SignupAttributionContext {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const context = value as Partial<SignupAttributionContext>
    return (
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

export function readSignupAttribution(): SignupAttributionContext | null {
    const stored = getFromCookie(SIGNUP_ATTRIBUTION_COOKIE)
    return isContext(stored) ? stored : null
}

export function captureSignupAttribution(): SignupAttributionContext | null {
    const touch = currentTouch()
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
            : touch.path && isContentPath(touch.path)
              ? { firstContentTouch: touch }
              : {}),
        ...(touch.utmSource || touch.utmMedium || touch.utmCampaign || touch.utmContent || touch.referrerHost
            ? { lastTouch: touch }
            : existing?.lastTouch
              ? { lastTouch: existing.lastTouch }
              : {}),
    }

    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, context, SIGNUP_ATTRIBUTION_EXPIRY_DAYS)
    return context
}

export function restoreSignupAttribution(context: SignupAttributionContext): SignupAttributionContext {
    const existing = readSignupAttribution()
    const restored: SignupAttributionContext = {
        ...context,
        captureMethod: 'deferred_link',
        firstContentTouch: context.firstContentTouch ?? existing?.firstContentTouch,
        lastTouch: context.lastTouch ?? existing?.lastTouch,
    }
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, restored, SIGNUP_ATTRIBUTION_EXPIRY_DAYS)
    return restored
}

export function clearSignupAttribution(): void {
    saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, '')
}

export function serializeSignupAttribution(
    context: SignupAttributionContext | null = readSignupAttribution()
): string | null {
    return context ? JSON.stringify(context) : null
}

export function parseSignupAttribution(value: string | null | undefined): SignupAttributionContext | null {
    if (!value) return null
    try {
        const parsed: unknown = JSON.parse(value)
        return isContext(parsed) ? parsed : null
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
