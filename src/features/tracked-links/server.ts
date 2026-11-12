import { PEANUT_API_URL } from '@/constants/general.consts'
import type { paths } from '@/types/api.generated'

export const TRACKED_LINK_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
}

export type InviteLinkLookup = { status: 'found'; linkId: string } | { status: 'not_found' } | { status: 'unavailable' }

type InviteLinkBody = paths['/tracked-links/invites/{username}']['get']['responses'][200]['content']['application/json']

const LOOKUP_TIMEOUT_MS = 1800
const CACHE_TTL_MS = 60_000
// Unknown slugs are caller-chosen, so the cache is bounded rather than precisely evicted.
const CACHE_MAX_ENTRIES = 1000
const cache = new Map<string, { lookup: InviteLinkLookup; expiresAt: number }>()

/**
 * Resolve a creator username to its stable link ID. Requests share Vercel egress IPs,
 * so found and unknown answers are reused briefly; an outage is never cached.
 */
export async function lookupInviteLink(slug: string): Promise<InviteLinkLookup> {
    const cached = cache.get(slug)
    if (cached && cached.expiresAt > Date.now()) return cached.lookup
    const lookup = await fetchInviteLink(slug)
    if (lookup.status !== 'unavailable') {
        if (cache.size >= CACHE_MAX_ENTRIES) cache.clear()
        cache.set(slug, { lookup, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return lookup
}

async function fetchInviteLink(slug: string): Promise<InviteLinkLookup> {
    try {
        const response = await fetch(`${PEANUT_API_URL}/tracked-links/invites/${encodeURIComponent(slug)}`, {
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            headers: { Accept: 'application/json' },
        })
        if (response.status === 404) return { status: 'not_found' }
        if (!response.ok) return { status: 'unavailable' }
        // A deploy mismatch must read as an outage, not as a link without an ID.
        const { linkId } = (await response.json()) as Partial<InviteLinkBody>
        return typeof linkId === 'string' ? { status: 'found', linkId } : { status: 'unavailable' }
    } catch {
        return { status: 'unavailable' }
    }
}
