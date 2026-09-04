import type { Translations } from '@/i18n/types'

export type BucketState = 'operational' | 'degraded' | 'down' | 'unknown'

export interface StatusBucket {
    hourStart: string
    state: BucketState
    checks: number
    failures: number
}

export const INCIDENT_REASONS = ['timeout', 'unreachable', 'provider_error', 'provider_rejected', 'unknown'] as const

export type IncidentReason = (typeof INCIDENT_REASONS)[number]

export interface StatusIncident {
    id: string
    startedAt: string
    resolvedAt: string | null
    reason: IncidentReason
}

export interface StatusProvider {
    provider: string
    state: BucketState
    uptimePct: number | null
    buckets: StatusBucket[]
    incidents: StatusIncident[]
}

export interface StatusSummary {
    generatedAt: string
    windowHours: number
    state: BucketState
    providers: StatusProvider[]
}

/**
 * Display order and grouping for the page. The API returns provider keys and
 * raw samples only — what a key is *called* is a product decision, and a
 * translated one, so it lives here rather than in the backend.
 *
 * Deliberately absent: the API's own liveness, the AA bundler and ENS name
 * resolution. They are monitored and alerted on, but a public page that lists
 * `zerodev` tells a user nothing they can act on.
 */
/**
 * What the reader loses while a service is down, in their language.
 *
 * The feed publishes a classified `reason`, never the provider's own words:
 * "Failed to get price: Company blocked." is a sentence for whoever is fixing
 * it, not for someone trying to work out whether their transfer arrived. Each
 * service therefore owns an impact line answering the only two questions a
 * reader has — what can't I do, and is my money safe — with the reason
 * appended as a short second clause.
 */
export const REASON_LABELS: Record<IncidentReason, (i18n: Translations) => string> = {
    timeout: (i18n) => i18n.statusReasonTimeout,
    unreachable: (i18n) => i18n.statusReasonUnreachable,
    provider_error: (i18n) => i18n.statusReasonProviderError,
    provider_rejected: (i18n) => i18n.statusReasonProviderRejected,
    unknown: (i18n) => i18n.statusReasonUnknown,
}

const IMPACT_LABELS: Record<string, (i18n: Translations) => string> = {
    app: (i18n) => i18n.statusImpactApp,
    sumsub: (i18n) => i18n.statusImpactSumsub,
    'manteca-ar': (i18n) => i18n.statusImpactMantecaAr,
    'manteca-br': (i18n) => i18n.statusImpactMantecaBr,
    bridge: (i18n) => i18n.statusImpactBridge,
    rhino: (i18n) => i18n.statusImpactRhino,
    rpc: (i18n) => i18n.statusImpactRpc,
    mobula: (i18n) => i18n.statusImpactMobula,
    rain: (i18n) => i18n.statusImpactRain,
}

export function incidentImpact(serviceKey: string, i18n: Translations): string {
    // A service we have copy for is the norm; the fallback matters when the
    // API starts publishing a key before this deploy knows about it.
    return (IMPACT_LABELS[serviceKey] ?? ((t: Translations) => t.statusImpactGeneric))(i18n)
}

export function incidentReasonLabel(reason: IncidentReason, i18n: Translations): string {
    return (REASON_LABELS[reason] ?? REASON_LABELS.unknown)(i18n)
}

export const STATUS_GROUPS: Array<{
    label: (i18n: Translations) => string
    services: Array<{ key: string; label: (i18n: Translations) => string }>
}> = [
    {
        label: (i18n) => i18n.statusGroupApp,
        services: [
            { key: 'app', label: (i18n) => i18n.statusServiceApp },
            { key: 'sumsub', label: (i18n) => i18n.statusServiceSumsub },
        ],
    },
    {
        label: (i18n) => i18n.categoryDepositsWithdrawals,
        services: [
            { key: 'manteca-ar', label: (i18n) => i18n.statusServiceMantecaAr },
            { key: 'manteca-br', label: (i18n) => i18n.statusServiceMantecaBr },
            { key: 'bridge', label: (i18n) => i18n.statusServiceBridge },
        ],
    },
    {
        label: (i18n) => i18n.categorySendingReceiving,
        services: [
            { key: 'rhino', label: (i18n) => i18n.statusServiceRhino },
            { key: 'rpc', label: (i18n) => i18n.statusServiceRpc },
            { key: 'mobula', label: (i18n) => i18n.statusServiceMobula },
        ],
    },
    {
        label: (i18n) => i18n.categoryPayments,
        services: [{ key: 'rain', label: (i18n) => i18n.statusServiceRain }],
    },
]

const BUCKET_STATES: BucketState[] = ['operational', 'degraded', 'down', 'unknown']

function isBucket(value: unknown): value is StatusBucket {
    const b = value as StatusBucket
    return !!b && typeof b.hourStart === 'string' && BUCKET_STATES.includes(b.state)
}

function isProvider(value: unknown): value is StatusProvider {
    const p = value as StatusProvider
    return (
        !!p &&
        typeof p.provider === 'string' &&
        BUCKET_STATES.includes(p.state) &&
        Array.isArray(p.buckets) &&
        p.buckets.every(isBucket) &&
        Array.isArray(p.incidents) &&
        p.incidents.every(
            (i) =>
                !!i &&
                typeof i.id === 'string' &&
                typeof i.startedAt === 'string' &&
                INCIDENT_REASONS.includes(i.reason)
        )
    )
}

/**
 * `as StatusSummary` is a compile-time claim about a payload that arrives at
 * runtime. A 200 carrying `{}` would satisfy the type and then throw inside
 * `providers.map` — past the point where the page can still fall back, on the
 * one page whose entire job is to render when things are broken.
 */
export function parseStatusSummary(value: unknown): StatusSummary | null {
    const s = value as StatusSummary
    if (!s || typeof s !== 'object') return null
    if (!BUCKET_STATES.includes(s.state)) return null
    // The page refuses a summary older than a few minutes, so a payload that
    // cannot say when it was made is a payload it cannot check.
    if (typeof s.generatedAt !== 'string') return null
    if (!Array.isArray(s.providers) || !s.providers.every(isProvider)) return null
    return s
}

/**
 * How old a summary may be before the page stops believing it.
 *
 * This is the page's only defence against a cached "all operational" outliving
 * the system it describes — both Next's Data Cache and a CDN keep serving the
 * last good body over a dead origin, neither of them says so, and that is the
 * shape an outage takes from where this page sits.
 *
 * The budget is set by how old a *healthy* body can legitimately be: the feed
 * is served `max-age=60, stale-while-revalidate=300`, and Next's own cache
 * adds up to another 60s, so ~7 minutes. Ten leaves headroom against a false
 * outage while bounding how long a dead backend can read green.
 */
export const MAX_SUMMARY_AGE_MS = 10 * 60 * 1000

export function isFresh(summary: StatusSummary, now: number): boolean {
    const generatedAt = Date.parse(summary.generatedAt)
    return Number.isFinite(generatedAt) && now - generatedAt <= MAX_SUMMARY_AGE_MS
}
