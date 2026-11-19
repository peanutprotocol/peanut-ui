import { getFromCookie, getFromLocalStorage, removeFromCookie, saveToLocalStorage } from '@/utils/general.utils'

/**
 * Badge campaigns are opaque backend-owned identities. The UI may transport them,
 * but it must never translate them into badge codes or derive them from an
 * inviter. In particular, `?code=juanacervio` carries no NITA campaign unless
 * `?badge_campaign=nita` is also present.
 */
/**
 * The pending queue is one localStorage record with its expiry inside, NOT a
 * cookie: iOS WKWebView (capacitor://localhost) ignores cookie writes, so no
 * iOS badge campaign survived to signup (TASK-25110). Same move as invite-stash.ts.
 */
export const PENDING_BADGE_CAMPAIGNS_STORAGE_KEY = 'peanut:pending-badge-campaigns'
const PENDING_BADGE_CAMPAIGNS_TTL_DAYS = 30
/** Cookie written by older bundles; still read once, then removed. Do not rename the string value. */
export const LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE = 'campaignTag'
/** Lossless cookie queue written by older bundles; still read once, then removed. */
export const LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE = 'campaignTagsV2'
/** Persisted account-boundary epoch; the string value is compatibility state. */
export const PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY = 'campaignIntentEpoch'
export const BADGE_CAMPAIGN_QUERY_PARAM = 'badge_campaign'
export const MAX_BADGE_CAMPAIGNS = 20
/** Maximum raw length for explicit values before source qualification. */
export const MAX_RAW_BADGE_CAMPAIGN_LENGTH = 64
/**
 * Deferred install payloads queued before the utm path retired (TASK-21226)
 * can still carry 68-character `utm:`-prefixed identities; keep accepting
 * that wire bound so in-flight queues settle instead of being rejected.
 * Remove the `utm:` allowance after 2026-10-01; no queued payload can outlive
 * that date.
 */
export const MAX_BADGE_CAMPAIGN_IDENTITY_LENGTH = MAX_RAW_BADGE_CAMPAIGN_LENGTH + 'utm:'.length

// Explicit logout invalidates every settlement that began under the prior
// account. The durable epoch is shared by tabs; the process counter preserves
// the same guarantee if localStorage is unavailable in a restricted browser.
let processBadgeCampaignIntentGeneration = 0

function getDurableBadgeCampaignIntentEpoch(): number {
    const value = getFromLocalStorage(PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY)
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export type BadgeCampaignSearchParams = Pick<URLSearchParams, 'entries' | 'getAll'>

export function sanitizeBadgeCampaignIdentities(
    values: readonly unknown[],
    maxLength = MAX_BADGE_CAMPAIGN_IDENTITY_LENGTH
): string[] {
    const badgeCampaigns: string[] = []
    const seen = new Set<string>()

    for (const value of values) {
        if (typeof value !== 'string') continue
        const badgeCampaign = value.trim()
        const normalized = badgeCampaign.toLowerCase()
        if (badgeCampaign.length === 0 || badgeCampaign.length > maxLength || seen.has(normalized)) {
            continue
        }
        seen.add(normalized)
        badgeCampaigns.push(badgeCampaign)
        if (badgeCampaigns.length === MAX_BADGE_CAMPAIGNS) break
    }

    return badgeCampaigns
}

/**
 * Canonical badge campaign parameters win as a group over published legacy
 * spellings, which in turn win over analytics-shaped UTM parameters. Presence
 * establishes precedence even if every value in that group is malformed: a
 * lower-priority parameter must never replace a rejected acquisition intent.
 *
 * Repeated values remain repeated identities (apart from case-insensitive
 * duplicate removal), and casing/punctuation are preserved for the backend.
 * `code` is deliberately not accepted by this function.
 */
/**
 * Published links stack campaigns either as repeated params or as one
 * comma-separated value (`?campaign=a,b`). Both shapes must survive; dropping
 * the CSV form would silently award only the first badge. Splitting happens
 * HERE and not in sanitize, because a stored queue identity may itself contain
 * a comma and must round-trip unchanged.
 */
function splitUrlCampaignValues(values: readonly string[]): string[] {
    return values.flatMap((value) => value.split(','))
}

function badgeCampaignsFromSearchParamsWithExplicitBound(
    searchParams: BadgeCampaignSearchParams,
    explicitMaxLength: number,
    splitCommas = true
): string[] {
    const split = splitCommas ? splitUrlCampaignValues : (values: readonly string[]) => [...values]
    const canonicalValues = split(searchParams.getAll(BADGE_CAMPAIGN_QUERY_PARAM))
    if (canonicalValues.length > 0) {
        return sanitizeBadgeCampaignIdentities(canonicalValues, explicitMaxLength)
    }

    const legacyExplicitValues = split(
        [...searchParams.entries()]
            .filter(([key]) => key === 'campaign' || key === 'campaignTag')
            .map(([, value]) => value)
    )
    if (legacyExplicitValues.length > 0) {
        return sanitizeBadgeCampaignIdentities(legacyExplicitValues, explicitMaxLength)
    }

    // utm_campaign is analytics-only (TASK-21226 retired the last badge alias);
    // it never becomes a badge identity.
    return []
}

/** Parse raw public URL values. Canonical slugs and legacy raw aliases are at most 64 characters. */
export function badgeCampaignsFromSearchParams(searchParams: BadgeCampaignSearchParams): string[] {
    return badgeCampaignsFromSearchParamsWithExplicitBound(searchParams, MAX_RAW_BADGE_CAMPAIGN_LENGTH)
}

/**
 * Deferred install payloads carry already-qualified queue identities, including
 * `utm:` plus a 64-character raw value. Keep the same precedence rules without
 * truncating that 68-character internal wire representation.
 */
export function badgeCampaignIdentitiesFromDeferredSearchParams(searchParams: BadgeCampaignSearchParams): string[] {
    // No comma splitting: these are already-qualified queue identities, not raw
    // public URL input, and one may legitimately contain a comma.
    return badgeCampaignsFromSearchParamsWithExplicitBound(searchParams, MAX_BADGE_CAMPAIGN_IDENTITY_LENGTH, false)
}

/**
 * Published send-link claim endpoints still expose a singular `campaignTag`
 * request field. Resolve their URL input through the shared namespace rules and
 * forward the first identity from the winning group. New typed badge-claim
 * callers must use the complete array returned above instead.
 */
export function badgeCampaignForLegacyWire(searchParams: BadgeCampaignSearchParams): string | undefined {
    return badgeCampaignsFromSearchParams(searchParams)[0]
}

/** Accept both the array queue and the legacy single-string cookie. */
export function parsePendingBadgeCampaigns(value: unknown): string[] {
    if (Array.isArray(value)) return sanitizeBadgeCampaignIdentities(value)
    return sanitizeBadgeCampaignIdentities([value])
}

function mergeBadgeCampaignQueues(existing: readonly string[], incoming: readonly string[]): string[] {
    const merged = [...sanitizeBadgeCampaignIdentities(existing)]
    for (const badgeCampaign of sanitizeBadgeCampaignIdentities(incoming)) {
        const existingIndex = merged.findIndex((candidate) => candidate.toLowerCase() === badgeCampaign.toLowerCase())
        if (existingIndex >= 0) merged.splice(existingIndex, 1)
        merged.push(badgeCampaign)
        if (merged.length > MAX_BADGE_CAMPAIGNS) merged.shift()
    }
    return merged
}

function readStoredBadgeCampaigns(): string[] {
    let raw: string | null
    try {
        raw = localStorage.getItem(PENDING_BADGE_CAMPAIGNS_STORAGE_KEY)
    } catch {
        return []
    }
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as { badgeCampaigns?: unknown; expiresAt?: unknown }
        if (typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
            return parsePendingBadgeCampaigns(parsed.badgeCampaigns)
        }
    } catch {}
    writeStoredBadgeCampaigns([])
    return []
}

function writeStoredBadgeCampaigns(badgeCampaigns: readonly string[], expiryDays = PENDING_BADGE_CAMPAIGNS_TTL_DAYS) {
    try {
        if (badgeCampaigns.length === 0) {
            localStorage.removeItem(PENDING_BADGE_CAMPAIGNS_STORAGE_KEY)
            return
        }
        const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000
        localStorage.setItem(PENDING_BADGE_CAMPAIGNS_STORAGE_KEY, JSON.stringify({ badgeCampaigns, expiresAt }))
    } catch {
        // Storage unavailable (private mode, sandboxed document): the badge is
        // lost, but signup must never fail because of it.
    }
}

function removeLegacyBadgeCampaignCookies(): void {
    removeFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE)
    removeFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE)
}

export function getPendingBadgeCampaigns(): string[] {
    const stored = readStoredBadgeCampaigns()
    // Queues written before the move to localStorage live in cookies on web
    // and Android. Move them over once; a cookie value counts as the newest.
    const v2 = parsePendingBadgeCampaigns(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGNS_V2_COOKIE))
    const legacy = parsePendingBadgeCampaigns(getFromCookie(LEGACY_PENDING_BADGE_CAMPAIGN_COOKIE))
    if (v2.length === 0 && legacy.length === 0) return stored

    const merged = mergeBadgeCampaignQueues(stored, mergeBadgeCampaignQueues(v2, legacy))
    writeStoredBadgeCampaigns(merged)
    removeLegacyBadgeCampaignCookies()
    return merged
}

export function getPendingBadgeCampaignIntentGeneration(): string {
    return `${processBadgeCampaignIntentGeneration}:${getDurableBadgeCampaignIntentEpoch()}`
}

export function savePendingBadgeCampaigns(badgeCampaigns: readonly string[], expiryDays?: number): void {
    writeStoredBadgeCampaigns(sanitizeBadgeCampaignIdentities(badgeCampaigns), expiryDays)
    removeLegacyBadgeCampaignCookies()
}

/** Add acquisition intent without dropping an earlier retryable campaign. */
export function queuePendingBadgeCampaigns(badgeCampaigns: readonly string[], expiryDays?: number): string[] {
    const incoming = sanitizeBadgeCampaignIdentities(badgeCampaigns)
    if (incoming.length === 0) return getPendingBadgeCampaigns()

    // A newly clicked acquisition must not disappear behind a queue already at
    // the contract cap. Move incoming identities to the newest end, evicting
    // only the oldest retryable entries when capacity is exhausted.
    const incomingKeys = new Set(incoming.map((badgeCampaign) => badgeCampaign.toLowerCase()))
    const existing = getPendingBadgeCampaigns().filter(
        (badgeCampaign) => !incomingKeys.has(badgeCampaign.toLowerCase())
    )
    const existingCapacity = MAX_BADGE_CAMPAIGNS - incoming.length
    const retainedExisting = existingCapacity > 0 ? existing.slice(-existingCapacity) : []
    const queued = [...retainedExisting, ...incoming]
    savePendingBadgeCampaigns(queued, expiryDays)
    return queued
}

/**
 * Badge campaign identities are bearer acquisition intents, not user-owned preferences.
 * Clear them on an intentional account switch so the next account cannot
 * inherit an award. Do not call this for passive auth expiry or network loss;
 * those cases retain the original user's safe retry path.
 */
export function clearPendingBadgeCampaigns(): void {
    processBadgeCampaignIntentGeneration += 1
    const durableEpoch = getDurableBadgeCampaignIntentEpoch()
    saveToLocalStorage(PENDING_BADGE_CAMPAIGN_INTENT_EPOCH_STORAGE_KEY, Math.max(Date.now(), durableEpoch + 1))
    writeStoredBadgeCampaigns([])
    removeLegacyBadgeCampaignCookies()
}
