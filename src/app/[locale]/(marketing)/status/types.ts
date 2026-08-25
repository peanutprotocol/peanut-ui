import type { Translations } from '@/i18n/types'

export type BucketState = 'operational' | 'degraded' | 'down' | 'unknown'

export interface StatusBucket {
    hourStart: string
    state: BucketState
    checks: number
    failures: number
}

export interface StatusIncident {
    id: string
    startedAt: string
    resolvedAt: string | null
    message: string
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
