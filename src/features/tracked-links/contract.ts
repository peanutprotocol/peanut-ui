import { cleanMarketingValue, cleanReferrerHost } from '@/utils/attribution-values'
import { UTM_MEDIUMS } from '@/utils/utm.utils'

export const TRACKED_LINK_EVENT = 'tracked_link_visit'
export const TRACKED_LINK_ORIGIN = 'https://peanut.me'

export const GO_PLACEMENTS = {
    ig: 'instagram',
    x: 'twitter',
    tt: 'tiktok',
    yt: 'youtube',
    fb: 'facebook',
    th: 'threads',
    wa: 'whatsapp',
    tg: 'telegram',
    li: 'linkedin',
    dc: 'discord',
    em: 'email',
    qr: 'qr',
} as const
export type GoPlacement = keyof typeof GO_PLACEMENTS

export type GoVisit = {
    username: string
    placement: GoPlacement | null
    /** 1–9999, one global sequence across all creators. */
    code: number | null
    utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null }
    referrerHost: string | null
}

export type CreatorPageProps = {
    /** linkId = `invite_<64 hex>`, equals tracked_link_visit.link_id. */
    creator: { username: string; linkId: string }
    variant: string
    /** Same-tab link; the page never builds or edits it. */
    ctaHref: string
    visit: GoVisit
}

/** The page selection a handoff carries as `tl_v` / `tl_e`. */
export type GoPageVariant = { variant: string; experimentId: string }

/** Signup-attribution touch fields, without `occurredAt`. */
export type GoTouch = {
    utmSource?: string
    utmMedium: string
    utmCampaign: string
    utmContent?: string
    referrerHost?: string
}

const GO_CODE_PATTERN = /^[1-9][0-9]{0,3}$/
const MAX_GO_LABEL_LENGTH = 64
const UTM_KEYS = ['source', 'medium', 'campaign', 'content'] as const
const MEDIUMS: ReadonlySet<string> = new Set(Object.values(UTM_MEDIUMS))

// Existing short usernames predate the current signup length rule. Identity still needs the API lookup.
export function isAcquisitionSlug(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9]{1,64}$/.test(value)
}

/** Query input never selects the inviter: the resolved slug is the only one carried. */
export function acquisitionHandoffPath(slug: string): string {
    return `/home?${new URLSearchParams({ app_entry: '1', tl: slug, acq_invite: slug })}`
}

export function bareGoVisit(username: string): GoVisit {
    return {
        username,
        placement: null,
        code: null,
        utm: { source: null, medium: null, campaign: null, content: null },
        referrerHost: null,
    }
}

/** An unknown segment is the bare link, never an error: a real creator never gets a 404 from it. */
export function parseGoSegment(segment: string | null | undefined): Pick<GoVisit, 'placement' | 'code'> {
    const value = segment?.toLowerCase() ?? ''
    if (Object.prototype.hasOwnProperty.call(GO_PLACEMENTS, value))
        return { placement: value as GoPlacement, code: null }
    return { placement: null, code: GO_CODE_PATTERN.test(value) ? Number(value) : null }
}

/** Null only for an invalid username (a 404). The creator comes from the path alone. */
export function parseGoRequest(request: Request, slug: string, segments: readonly string[] = []): GoVisit | null {
    const username = slug.toLowerCase()
    if (!isAcquisitionSlug(username)) return null
    const url = new URL(request.url)
    return {
        username,
        ...parseGoSegment(segments.length === 1 ? segments[0] : null),
        utm: parseUtm(url.searchParams),
        referrerHost: parseReferrerHost(request.headers.get('referer')),
    }
}

/** The path wins for source and content; the query fills the rest. */
export function goTouch(visit: GoVisit): GoTouch {
    const source = visit.placement ? GO_PLACEMENTS[visit.placement] : visit.utm.source
    const content = visit.code !== null ? `c${visit.code}` : visit.utm.content
    return {
        ...(source ? { utmSource: source } : {}),
        utmMedium: visit.utm.medium ?? UTM_MEDIUMS.AMBASSADOR,
        utmCampaign: visit.utm.campaign ?? 'go',
        ...(content ? { utmContent: content } : {}),
        ...(visit.referrerHost ? { referrerHost: visit.referrerHost } : {}),
    }
}

/** `/app`'s entry URL. The inviter is the path's username, both as `tl` and as the passive `acq_invite`. */
export function goHandoffPath(visit: GoVisit, page?: GoPageVariant): string {
    const params = new URLSearchParams({ app_entry: '1', tl: visit.username, acq_invite: visit.username })
    const segment = visit.placement ?? (visit.code !== null ? String(visit.code) : null)
    if (segment) params.set('tl_s', segment)
    for (const key of UTM_KEYS) {
        const value = visit.utm[key]
        if (value) params.set(`utm_${key}`, value)
    }
    if (visit.referrerHost) params.set('tl_r', visit.referrerHost)
    if (page) {
        params.set('tl_v', page.variant)
        params.set('tl_e', page.experimentId)
    }
    return `/home?${params}`
}

/** Reads a handoff back on `/app`. Every value is checked again: the URL is user input. */
export function parseGoVisitParams(params: URLSearchParams): GoVisit | null {
    const username = params.get('tl')
    if (!isAcquisitionSlug(username)) return null
    return {
        username,
        ...parseGoSegment(params.get('tl_s')),
        utm: parseUtm(params),
        referrerHost: cleanReferrerHost(params.get('tl_r')) ?? null,
    }
}

function parseUtm(params: URLSearchParams): GoVisit['utm'] {
    const [source, medium, campaign, content] = UTM_KEYS.map((key) => parseLabel(params.get(`utm_${key}`)))
    return { source, medium: medium && MEDIUMS.has(medium) ? medium : null, campaign, content }
}

function parseLabel(value: string | null): string | null {
    const cleaned = cleanMarketingValue(value)
    return cleaned && cleaned.length <= MAX_GO_LABEL_LENGTH ? cleaned : null
}

function parseReferrerHost(referer: string | null): string | null {
    let host: string | undefined
    try {
        host = referer ? cleanReferrerHost(new URL(referer).hostname) : undefined
    } catch {
        return null
    }
    // Our own pages are not a referral source.
    if (!host || host === 'peanut.me' || host.endsWith('.peanut.me')) return null
    return host
}
