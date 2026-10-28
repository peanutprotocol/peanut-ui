import { UTM_MEDIUMS, UTM_SOURCES } from '@/utils/utm.utils'

const LOCALES = ['en', 'es-419', 'es-ar', 'pt-br'] as const
const PAGE_SLOTS = {
    home: ['hero', 'app-fold', 'rates', 'countries'],
    'us-europe-accounts': ['hero', 'request-fold', 'close', 'artwork'],
    'qr-argentina': ['hero', 'close', 'artwork', 'hero-sticker', 'close-sticker'],
    'qr-brazil': ['hero', 'close', 'artwork', 'hero-sticker', 'close-sticker', 'ways-in'],
    'request-links': ['hero', 'close', 'artwork'],
    'self-custody': ['hero', 'close', 'artwork'],
} as const

export type MarketingQrContext = { page: keyof typeof PAGE_SLOTS; placement: string; locale: string }
export type MarketingQrCampaign = { source: string; medium: string; campaign: string; content?: string }
export type AttributionOrigin = 'current_url' | 'saved_campaign' | 'placement_default'
export type AttributionAdjustment = 'none' | 'content_trimmed' | 'length_fallback'
export type MarketingQrAttribution = {
    campaign: MarketingQrCampaign
    attributionOrigin: AttributionOrigin
    attributionAdjustment: AttributionAdjustment
}
export type MarketingQrRegistration = {
    qr_id: string
    page_id: string
    surface_type: 'landing'
    placement: string
    locale: (typeof LOCALES)[number]
    destination_key: 'app-entry'
    continuation: '/home'
    defaults: MarketingQrCampaign
}

export const MARKETING_QR_MAX_URL_BYTES = 200
export const MARKETING_QR_EVENT = 'marketing_qr_opened'
const SOURCES = new Set<string>(Object.values(UTM_SOURCES))
const MEDIUMS = new Set<string>(Object.values(UTM_MEDIUMS))
const ORIGINS: AttributionOrigin[] = ['current_url', 'saved_campaign', 'placement_default']
const ADJUSTMENTS: AttributionAdjustment[] = ['none', 'content_trimmed', 'length_fallback']
const COMPACT_KEYS = new Set(['s', 'm', 'c', 'n', 'o', 'a'])
const IDENTIFIER =
    /(?:^|[^a-z0-9])(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|0x[0-9a-f]{40}|[0-9a-f]{32,})(?:$|[^a-z0-9])/i

export const MARKETING_QR_REGISTRATIONS: readonly MarketingQrRegistration[] = Object.entries(PAGE_SLOTS).flatMap(
    ([page, slots]) =>
        (page === 'home' ? LOCALES : (['en'] as const)).flatMap((locale) =>
            slots.map((placement) => {
                const qr_id = `${page}-${placement}-${locale}`
                const inline = ['hero-sticker', 'close-sticker', 'ways-in'].includes(placement)
                return {
                    qr_id,
                    page_id: page === 'home' ? '/' : page.replace(/^qr-/, '/qr-payments/').replace(/^(?!\/)/, '/'),
                    surface_type: 'landing' as const,
                    placement,
                    locale,
                    destination_key: 'app-entry' as const,
                    continuation: '/home' as const,
                    defaults: inline
                        ? {
                              source: UTM_SOURCES.STAR_LP,
                              medium: UTM_MEDIUMS.CONTENT,
                              campaign: page === 'qr-argentina' ? 'qr-ar' : 'qr-br',
                              content: placement === 'hero-sticker' ? 'h' : placement === 'close-sticker' ? 'c' : 'w',
                          }
                        : {
                              source: UTM_SOURCES.MARKETING_QR,
                              medium: UTM_MEDIUMS.CONTENT,
                              campaign: 'landing',
                              content: qr_id,
                          },
                }
            })
        )
)

export function getMarketingQrRegistration(id: string): MarketingQrRegistration | null {
    return MARKETING_QR_REGISTRATIONS.find((registration) => registration.qr_id === id) ?? null
}

export function resolveMarketingQrRegistration(context: MarketingQrContext): MarketingQrRegistration | null {
    const locale = context.locale.toLowerCase() === 'es' ? 'es-419' : context.locale.toLowerCase()
    return getMarketingQrRegistration(`${context.page}-${context.placement}-${locale}`)
}

// Deliberately narrower than signup-attribution's marketing-value sanitizer.
// The endpoint accepts campaign labels, never URLs or common user identifiers.
function validLabel(value: unknown, max: number): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= max &&
        /^[a-z0-9][a-z0-9._~+ -]*$/.test(value) &&
        !/(?:^|\s)www\./.test(value) &&
        !IDENTIFIER.test(value) &&
        !(/^[\d+ ._-]+$/.test(value) && value.replace(/\D/g, '').length >= 7) &&
        !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
    )
}

export function validateMarketingQrCampaign(value: Partial<MarketingQrCampaign>): MarketingQrCampaign | null {
    const { source, medium, campaign, content } = value
    if (
        !validLabel(source, 32) ||
        !SOURCES.has(source) ||
        !validLabel(medium, 24) ||
        !MEDIUMS.has(medium) ||
        !validLabel(campaign, 64) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campaign)
    )
        return null
    return { source, medium, campaign, ...(validLabel(content, 64) ? { content } : {}) }
}

function defaults(registration: MarketingQrRegistration): MarketingQrAttribution {
    return { campaign: registration.defaults, attributionOrigin: 'placement_default', attributionAdjustment: 'none' }
}

function duplicateKeys(params: URLSearchParams): boolean {
    return [...params.keys()].some((key) => params.getAll(key).length !== 1)
}

function campaignFromParams(params: URLSearchParams, compact: boolean): Partial<MarketingQrCampaign> {
    return {
        source: params.get(compact ? 's' : 'utm_source') ?? undefined,
        medium: params.get(compact ? 'm' : 'utm_medium') ?? undefined,
        campaign: params.get(compact ? 'c' : 'utm_campaign') ?? undefined,
        content: params.get(compact ? 'n' : 'utm_content') ?? undefined,
    }
}

/** Invalid query data never rides to the store; the registered destination still works. */
export function parseMarketingQrQuery(
    registration: MarketingQrRegistration,
    params: URLSearchParams
): MarketingQrAttribution & { valid: boolean } {
    const fallback = defaults(registration)
    const origin = params.get('o')
    const adjustment = params.get('a')
    if (
        duplicateKeys(params) ||
        [...params.keys()].some((key) => !COMPACT_KEYS.has(key)) ||
        (origin !== null && !ORIGINS.includes(origin as AttributionOrigin)) ||
        (adjustment !== null && !ADJUSTMENTS.includes(adjustment as AttributionAdjustment))
    )
        return { ...fallback, valid: false }
    const raw = campaignFromParams(params, true)
    const required = [raw.source, raw.medium, raw.campaign]
    if (required.some((value) => value === undefined)) {
        const malformed =
            (raw.source !== undefined && (!validLabel(raw.source, 32) || !SOURCES.has(raw.source))) ||
            (raw.medium !== undefined && (!validLabel(raw.medium, 24) || !MEDIUMS.has(raw.medium))) ||
            (raw.campaign !== undefined &&
                (!validLabel(raw.campaign, 64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.campaign)))
        return {
            ...fallback,
            attributionAdjustment: adjustment === 'length_fallback' ? 'length_fallback' : 'none',
            valid: !malformed,
        }
    }
    const campaign = validateMarketingQrCampaign(raw)
    if (!campaign) return { ...fallback, valid: false }
    return {
        campaign,
        attributionOrigin: (origin as AttributionOrigin | null) ?? 'current_url',
        attributionAdjustment: (adjustment as AttributionAdjustment | null) ?? 'none',
        valid: true,
    }
}

export function buildMarketingQrUrl({
    origin,
    context,
    searchParams = new URLSearchParams(),
    savedCampaign,
    analyticsEnabled = false,
}: {
    origin: string
    context: MarketingQrContext
    searchParams?: URLSearchParams
    savedCampaign?: Partial<MarketingQrCampaign> | null
    analyticsEnabled?: boolean
}): string | null {
    const registration = resolveMarketingQrRegistration(context)
    if (!registration) return null
    let base: string
    try {
        const parsedOrigin = new URL(origin)
        if (!['https:', 'http:'].includes(parsedOrigin.protocol) || parsedOrigin.username || parsedOrigin.password)
            return null
        base = `${parsedOrigin.origin}/q/${registration.qr_id}`
    } catch {
        return null
    }
    let attribution = defaults(registration)
    if (analyticsEnabled) {
        const current = duplicateKeys(searchParams)
            ? null
            : validateMarketingQrCampaign(campaignFromParams(searchParams, false))
        const saved = savedCampaign ? validateMarketingQrCampaign(savedCampaign) : null
        if (current) attribution = { ...attribution, campaign: current, attributionOrigin: 'current_url' }
        else if (saved) attribution = { ...attribution, campaign: saved, attributionOrigin: 'saved_campaign' }
    }
    const encode = () => {
        const params = new URLSearchParams()
        if (attribution.attributionOrigin !== 'placement_default') {
            const { source, medium, campaign, content } = attribution.campaign
            params.set('s', source)
            params.set('m', medium)
            params.set('c', campaign)
            if (content) params.set('n', content)
            params.set('o', attribution.attributionOrigin)
        }
        if (attribution.attributionAdjustment !== 'none') params.set('a', attribution.attributionAdjustment)
        const query = params.toString()
        return `${base}${query ? `?${query}` : ''}`
    }
    let url = encode()
    if (url.length > MARKETING_QR_MAX_URL_BYTES && attribution.campaign.content) {
        const { content: _content, ...campaign } = attribution.campaign
        attribution = { ...attribution, campaign, attributionAdjustment: 'content_trimmed' }
        url = encode()
    }
    if (url.length > MARKETING_QR_MAX_URL_BYTES) {
        attribution = { ...defaults(registration), attributionAdjustment: 'length_fallback' }
        url = encode()
    }
    return url.length <= MARKETING_QR_MAX_URL_BYTES ? url : null
}

export function marketingQrContinuation(
    registration: MarketingQrRegistration,
    campaign: MarketingQrCampaign,
    analyticsAllowed: boolean
): string {
    const params = new URLSearchParams({
        app_entry: '1',
        marketing_qr: registration.qr_id,
        qr_analytics: analyticsAllowed ? 'allow' : 'deny',
    })
    if (analyticsAllowed) {
        params.set('utm_source', campaign.source)
        params.set('utm_medium', campaign.medium)
        params.set('utm_campaign', campaign.campaign)
        if (campaign.content) params.set('utm_content', campaign.content)
    }
    return `/home?${params}`
}

export function parseMarketingQrHandoff(
    params: URLSearchParams
): { registration: MarketingQrRegistration; campaign: MarketingQrCampaign; analyticsAllowed: boolean } | null {
    const registration = getMarketingQrRegistration(params.get('marketing_qr') ?? '')
    if (!registration) return null
    const allowed = new Set([
        'app_entry',
        'marketing_qr',
        'qr_analytics',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
    ])
    const campaign = validateMarketingQrCampaign(campaignFromParams(params, false))
    const analyticsAllowed =
        params.get('qr_analytics') === 'allow' &&
        !duplicateKeys(params) &&
        [...params.keys()].every((key) => allowed.has(key)) &&
        campaign !== null &&
        (params.get('utm_content') ?? undefined) === campaign.content
    return { registration, campaign: analyticsAllowed ? campaign! : registration.defaults, analyticsAllowed }
}
