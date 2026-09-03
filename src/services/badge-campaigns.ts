import {
    getPendingBadgeCampaigns,
    getPendingBadgeCampaignIntentGeneration,
    sanitizeBadgeCampaignIdentities,
    savePendingBadgeCampaigns,
} from '@/components/Invites/badge-campaign-context'
import { serverFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

type GeneratedBadgeCampaignClaimRequest = paths['/badge/claims']['post']['requestBody']['content']['application/json']
type GeneratedBadgeCampaignClaimBatch = paths['/badge/claims']['post']['responses'][200]['content']['application/json']
type GeneratedBadgeCampaignClaim = GeneratedBadgeCampaignClaimBatch['claims'][number]
type GeneratedBadgePresentation = NonNullable<GeneratedBadgeCampaignClaim['badge']>

export type BadgeCampaignClaimOutcome =
    | GeneratedBadgeCampaignClaim['outcome']
    | 'retryable_error'
    | 'legacy_response_unconfirmed'

type CompatibleBadgePresentation = Omit<GeneratedBadgePresentation, 'description' | 'publicDescription' | 'iconUrl'> & {
    description: string | null
    publicDescription?: string | null
    iconUrl: string | null
}

export type BadgeCampaignClaim = Omit<GeneratedBadgeCampaignClaim, 'badge' | 'outcome'> & {
    badge?: CompatibleBadgePresentation
    outcome: BadgeCampaignClaimOutcome
    httpStatus?: number
}

export type BadgeCampaignClaimBatch = {
    claims: BadgeCampaignClaim[]
    transport: 'canonical' | 'legacy'
}

type BackendBadgeCampaignClaim = Omit<BadgeCampaignClaim, 'outcome' | 'httpStatus'> & {
    outcome: GeneratedBadgeCampaignClaim['outcome']
}

const BACKEND_OUTCOMES = new Set<BackendBadgeCampaignClaim['outcome']>([
    'awarded',
    'already_owned',
    'inactive',
    'expired',
    'unknown',
    'definition_missing',
])

/**
 * Outcomes that are fully resolved and should not loop on the next app open.
 * `definition_missing` is deliberately retryable: it commonly means the API
 * code deployed before its boot-seeded definition. Transport failures and an
 * old endpoint's unconfirmed 200 also remain pending.
 */
const CONSUMED_OUTCOMES = new Set<BadgeCampaignClaimOutcome>([
    'awarded',
    'already_owned',
    'inactive',
    'expired',
    'unknown',
])

function uniqueBadgeCampaigns(badgeCampaigns: readonly string[]): string[] {
    return sanitizeBadgeCampaignIdentities(badgeCampaigns)
}

function retryableClaims(badgeCampaigns: readonly string[], httpStatus?: number): BadgeCampaignClaim[] {
    return badgeCampaigns.map((badgeCampaign) => ({
        badgeCampaign,
        outcome: 'retryable_error',
        httpStatus,
    }))
}

function terminalUnknownClaims(badgeCampaigns: readonly string[], httpStatus: number): BadgeCampaignClaim[] {
    return badgeCampaigns.map((badgeCampaign) => ({
        badgeCampaign,
        outcome: 'unknown',
        httpStatus,
    }))
}

function isRetryableHttpStatus(status: number): boolean {
    return (
        status === 401 ||
        status === 404 ||
        status === 405 ||
        status === 408 ||
        status === 425 ||
        status === 429 ||
        status >= 500
    )
}

type BadgePresentation = NonNullable<BadgeCampaignClaim['badge']>

function parseBadgePresentation(value: unknown): BadgePresentation | undefined {
    if (!value || typeof value !== 'object') return undefined
    const badge = value as {
        code?: unknown
        name?: unknown
        description?: unknown
        publicDescription?: unknown
        iconUrl?: unknown
    }
    if (
        typeof badge.code !== 'string' ||
        typeof badge.name !== 'string' ||
        (typeof badge.description !== 'string' && badge.description !== null) ||
        (badge.publicDescription !== undefined &&
            typeof badge.publicDescription !== 'string' &&
            badge.publicDescription !== null) ||
        (typeof badge.iconUrl !== 'string' && badge.iconUrl !== null)
    ) {
        return undefined
    }

    return {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        ...(badge.publicDescription !== undefined ? { publicDescription: badge.publicDescription } : {}),
        iconUrl: badge.iconUrl,
    }
}

/**
 * Project the public response onto acquisition state the client understands.
 * Badge provenance is audit metadata, not a trust tier: confirmed public awards
 * retain the badge's existing product semantics. Unknown policy/reward fields
 * are ignored, while the small destination enum is validated before routing.
 */
function parseBackendBadgeCampaignClaim(value: unknown): BackendBadgeCampaignClaim | undefined {
    if (!value || typeof value !== 'object') return undefined
    const claim = value as {
        badgeCampaign?: unknown
        campaignTag?: unknown
        badgeCode?: unknown
        badge?: unknown
        outcome?: unknown
    }
    // During rolling deploys, accept the published legacy echo only when the
    // canonical field is absent. Presence of a malformed canonical value is a
    // malformed response, never permission to reinterpret a second field.
    const hasCanonicalBadgeCampaign = Object.prototype.hasOwnProperty.call(claim, 'badgeCampaign')
    const badgeCampaign = hasCanonicalBadgeCampaign ? claim.badgeCampaign : claim.campaignTag
    const badge = claim.badge === undefined ? undefined : parseBadgePresentation(claim.badge)
    if (
        typeof badgeCampaign !== 'string' ||
        badgeCampaign.length === 0 ||
        typeof claim.outcome !== 'string' ||
        !BACKEND_OUTCOMES.has(claim.outcome as BackendBadgeCampaignClaim['outcome']) ||
        (claim.badgeCode !== undefined && typeof claim.badgeCode !== 'string') ||
        (claim.badge !== undefined && !badge)
    ) {
        return undefined
    }

    return {
        badgeCampaign,
        outcome: claim.outcome as BackendBadgeCampaignClaim['outcome'],
        ...(typeof claim.badgeCode === 'string' ? { badgeCode: claim.badgeCode } : {}),
        ...(badge ? { badge } : {}),
    }
}

async function responseJson(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch {
        return null
    }
}

function alignClaims(
    requested: readonly string[],
    received: readonly BackendBadgeCampaignClaim[]
): BadgeCampaignClaim[] {
    return requested.map((badgeCampaign) => {
        const claim = received.find(
            (candidate) => candidate.badgeCampaign.toLowerCase() === badgeCampaign.toLowerCase()
        )
        return (
            claim ?? {
                badgeCampaign,
                outcome: 'retryable_error',
            }
        )
    })
}

/**
 * Runtime boundary shared by canonical acquisition and compatibility responses
 * such as `/invites/accept`. Generated types catch compile-time drift; this
 * validator prevents a partial rolling-deploy response from becoming a false
 * success in the browser.
 */
export function badgeCampaignClaimsFromPayload(payload: unknown, requested: readonly string[]): BadgeCampaignClaim[] {
    const received =
        payload && typeof payload === 'object' && Array.isArray((payload as { claims?: unknown }).claims)
            ? (payload as { claims: unknown[] }).claims.flatMap((claim) => {
                  const parsed = parseBackendBadgeCampaignClaim(claim)
                  return parsed ? [parsed] : []
              })
            : []
    return alignClaims(uniqueBadgeCampaigns(requested), received)
}

async function claimThroughLegacyEndpoint(badgeCampaigns: readonly string[]): Promise<BadgeCampaignClaimBatch> {
    const claims: BadgeCampaignClaim[] = []

    for (const badgeCampaign of badgeCampaigns) {
        try {
            const response = await serverFetch('/badge/award', {
                method: 'POST',
                // Published compatibility field; do not rename.
                body: JSON.stringify({ campaignTag: badgeCampaign }),
            })
            const body = await responseJson(response)
            const structured =
                body && typeof body === 'object'
                    ? ((body as { claim?: unknown; claims?: unknown }).claim ??
                      (Array.isArray((body as { claims?: unknown }).claims)
                          ? (body as { claims: unknown[] }).claims[0]
                          : undefined))
                    : undefined

            const parsedClaim = parseBackendBadgeCampaignClaim(structured)
            if (response.ok && parsedClaim?.badgeCampaign.toLowerCase() === badgeCampaign.toLowerCase()) {
                claims.push(parsedClaim)
            } else if (response.ok) {
                // The old endpoint returned 200 even when awardBadge no-op'd.
                // Preserve the campaign for the canonical endpoint to verify.
                claims.push({ badgeCampaign, outcome: 'legacy_response_unconfirmed' })
            } else if (isRetryableHttpStatus(response.status)) {
                // The historical endpoint used 400 for a non-claimable tag.
                // Its 404/405 therefore means the compatibility route itself
                // is absent during a rolling deploy, not a terminal outcome.
                claims.push(...retryableClaims([badgeCampaign], response.status))
            } else {
                // Legacy 400 meant "not claimable" but exposed no typed reason.
                // Consume it as terminal unknown rather than looping forever.
                claims.push(...terminalUnknownClaims([badgeCampaign], response.status))
            }
        } catch {
            claims.push(...retryableClaims([badgeCampaign]))
        }
    }

    return { claims, transport: 'legacy' }
}

async function requestBadgeCampaignClaims(badgeCampaigns: readonly string[]): Promise<BadgeCampaignClaimBatch> {
    try {
        const response = await serverFetch('/badge/claims', {
            method: 'POST',
            body: JSON.stringify({ badgeCampaigns: [...badgeCampaigns] } satisfies GeneratedBadgeCampaignClaimRequest),
        })

        // Compatibility is deliberately narrow: only an API version that does
        // not expose the canonical route may use the legacy endpoint.
        if (response.status === 404 || response.status === 405) {
            return claimThroughLegacyEndpoint(badgeCampaigns)
        }

        if (!response.ok) {
            return {
                claims: isRetryableHttpStatus(response.status)
                    ? retryableClaims(badgeCampaigns, response.status)
                    : terminalUnknownClaims(badgeCampaigns, response.status),
                transport: 'canonical',
            }
        }

        const body = await responseJson(response)
        return {
            claims: badgeCampaignClaimsFromPayload(body, badgeCampaigns),
            transport: 'canonical',
        }
    } catch {
        return { claims: retryableClaims(badgeCampaigns), transport: 'canonical' }
    }
}

const inFlight = new Map<string, Promise<BadgeCampaignClaimBatch>>()

/** The sole frontend badge-acquisition call. Badge campaign identities stay opaque. */
export function claimBadgeCampaigns(rawBadgeCampaigns: readonly string[]): Promise<BadgeCampaignClaimBatch> {
    const badgeCampaigns = uniqueBadgeCampaigns(rawBadgeCampaigns)
    if (badgeCampaigns.length === 0) return Promise.resolve({ claims: [], transport: 'canonical' })

    // Deduplicate only within one account-intent generation. Reusing an old
    // account's authenticated response after explicit logout could otherwise
    // consume the next account's identical pending campaign without awarding it.
    const key = JSON.stringify([getPendingBadgeCampaignIntentGeneration(), badgeCampaigns])
    const existing = inFlight.get(key)
    if (existing) return existing

    const request = requestBadgeCampaignClaims(badgeCampaigns).finally(() => inFlight.delete(key))
    inFlight.set(key, request)
    return request
}

export function pendingBadgeCampaignsAfterClaims(
    requested: readonly string[],
    claims: readonly BadgeCampaignClaim[]
): string[] {
    return uniqueBadgeCampaigns(requested).filter((badgeCampaign) => {
        const claim = claims.find((candidate) => candidate.badgeCampaign.toLowerCase() === badgeCampaign.toLowerCase())
        return !claim || !CONSUMED_OUTCOMES.has(claim.outcome)
    })
}

export function settlePendingBadgeCampaigns(
    requested: readonly string[],
    claims: readonly BadgeCampaignClaim[],
    expectedIntentGeneration = getPendingBadgeCampaignIntentGeneration()
): string[] {
    // Explicit logout is an account-boundary write and must win over a stale
    // response. Passive auth expiry never advances this generation, so ordinary
    // offline/configuration retries remain durable.
    if (expectedIntentGeneration !== getPendingBadgeCampaignIntentGeneration()) return getPendingBadgeCampaigns()

    const requestedKeys = new Set(uniqueBadgeCampaigns(requested).map((badgeCampaign) => badgeCampaign.toLowerCase()))
    const untouched = getPendingBadgeCampaigns().filter(
        (badgeCampaign) => !requestedKeys.has(badgeCampaign.toLowerCase())
    )
    const pending = uniqueBadgeCampaigns([...untouched, ...pendingBadgeCampaignsAfterClaims(requested, claims)])
    savePendingBadgeCampaigns(pending, pending.length > 0 ? 30 : undefined)
    return pending
}

export async function claimAndSettlePendingBadgeCampaigns(
    requested: readonly string[] = getPendingBadgeCampaigns()
): Promise<BadgeCampaignClaimBatch & { pending: string[] }> {
    const intentGeneration = getPendingBadgeCampaignIntentGeneration()
    const batch = await claimBadgeCampaigns(requested)
    return { ...batch, pending: settlePendingBadgeCampaigns(requested, batch.claims, intentGeneration) }
}

export function isConfirmedBadgeCampaignClaim(claim: BadgeCampaignClaim): boolean {
    return claim.outcome === 'awarded' || claim.outcome === 'already_owned'
}

export function isUnavailableBadgeCampaignClaim(claim: BadgeCampaignClaim): boolean {
    return claim.outcome === 'inactive' || claim.outcome === 'expired' || claim.outcome === 'unknown'
}
