import type {
    FeatureReverificationConflict,
    FeatureReverificationEntry,
    FeatureReverificationOutcome,
    FeatureReverificationStatus,
} from '@/app/actions/types/kyc-reverification.types'
import type { PaperworkVerificationFeature } from '@/app/actions/types/kyc-paperwork-verification.types'

const FEATURES: ReadonlySet<unknown> = new Set<PaperworkVerificationFeature>(['card', 'bank', 'local'])
const PROVIDERS: ReadonlySet<unknown> = new Set<FeatureReverificationEntry['targetProvider']>([
    'RAIN',
    'BRIDGE',
    'MANTECA',
    'AVENIA',
])
const STATUSES: ReadonlySet<unknown> = new Set<FeatureReverificationStatus>([
    'READY',
    'COLLECTING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED',
])

export function isFeatureReverificationStatus(status: unknown): status is FeatureReverificationStatus {
    return STATUSES.has(status)
}

export function isFeatureReverificationOutcome(status: unknown): status is FeatureReverificationOutcome {
    return status === 'APPROVED' || status === 'REJECTED' || status === 'SUPERSEDED'
}

export function kycRetryDeadline(header?: string): number {
    if (!header) return 0
    const deadline = /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Date.parse(header)
    return Number.isSafeInteger(deadline) ? deadline : 0
}

export function isFeatureReverificationEntry(value: unknown): value is FeatureReverificationEntry {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const entry = value as Partial<FeatureReverificationEntry>
    return (
        entry.kind === 'reverify_for_feature' &&
        FEATURES.has(entry.feature) &&
        PROVIDERS.has(entry.targetProvider) &&
        (entry.prepared === undefined || typeof entry.prepared === 'boolean') &&
        (entry.attemptId === null || (typeof entry.attemptId === 'string' && entry.attemptId.length > 0))
    )
}

export function featureReverificationConflict(status: number, body: unknown): FeatureReverificationConflict | null {
    if (status !== 409 || !body || typeof body !== 'object' || Array.isArray(body)) return null
    const conflict = body as Partial<FeatureReverificationConflict>
    if (
        conflict.code !== 'feature_reverification_required' ||
        typeof conflict.userMessage !== 'string' ||
        typeof conflict.message !== 'string' ||
        typeof conflict.error !== 'string' ||
        !isFeatureReverificationEntry(conflict.entry)
    )
        return null
    return {
        code: conflict.code,
        userMessage: conflict.userMessage,
        message: conflict.message,
        error: conflict.error,
        entry: conflict.entry,
    }
}

export function safeReverificationReturnTo(value?: string | null): string | null {
    if (!value || value.length > 4096 || !value.startsWith('/') || /^\/[/\\]|[\\\u0000-\u001f\u007f]/.test(value))
        return null
    const url = new URL(value, 'https://peanut.invalid')
    if (url.origin !== 'https://peanut.invalid' || url.pathname.startsWith('//') || /^\/verify\/?$/i.test(url.pathname))
        return null
    return `${url.pathname}${url.search}${url.hash}`
}

export function currentReverificationDestination(): string | null {
    if (typeof window === 'undefined') return null
    const { pathname, search, hash } = window.location
    return safeReverificationReturnTo(`${pathname}${search}${hash}`)
}

export function featureReverificationPath(
    entry: Pick<FeatureReverificationEntry, 'feature' | 'targetProvider'>,
    returnTo?: string | null
): string {
    const query = new URLSearchParams({ mode: 'reverify', feature: entry.feature })
    const destination = safeReverificationReturnTo(returnTo)
    if (destination) {
        query.set('returnTo', destination)
        query.set('targetProvider', entry.targetProvider)
    }
    return `/verify?${query}`
}
