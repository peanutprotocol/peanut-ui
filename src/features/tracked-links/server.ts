import { PEANUT_API_URL } from '@/constants/general.consts'
import type { paths } from '@/types/api.generated'

export const TRACKED_LINK_HEADERS = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
}

export type InviteLinkLookup = { status: 'found'; linkId: string } | { status: 'not_found' } | { status: 'unavailable' }

type InviteLinkResponses = paths['/tracked-links/invites/{username}']['get']['responses']
type InviteLinkBody = InviteLinkResponses[200]['content']['application/json']
const LINK_NOT_FOUND: InviteLinkResponses[404]['content']['application/json']['error'] = 'Link not found'

const LOOKUP_TIMEOUT_MS = 1800
const CACHE_TTL_MS = 60_000
// Unknown slugs are caller-chosen, so the cache is bounded.
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
        // Re-inserting keeps Map order equal to expiry order, so the oldest entry expires first.
        cache.delete(slug)
        evictForInsert()
        cache.set(slug, { lookup, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return lookup
}

function evictForInsert(): void {
    if (cache.size < CACHE_MAX_ENTRIES) return
    const now = Date.now()
    for (const [slug, entry] of cache) {
        if (entry.expiresAt > now) break
        cache.delete(slug)
    }
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!)
}

async function fetchInviteLink(slug: string): Promise<InviteLinkLookup> {
    try {
        const response = await fetch(`${PEANUT_API_URL}/tracked-links/invites/${encodeURIComponent(slug)}`, {
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            headers: { Accept: 'application/json' },
        })
        // Only the route's own answer means "no such creator": a generic 404 (the route not
        // deployed yet) must not turn every creator link into "Link not found".
        if (response.status === 404)
            return (await isLinkNotFound(response)) ? { status: 'not_found' } : { status: 'unavailable' }
        if (!response.ok) return { status: 'unavailable' }
        // A deploy mismatch must read as an outage, not as a link without an ID.
        const { linkId } = (await response.json()) as Partial<InviteLinkBody>
        return typeof linkId === 'string' ? { status: 'found', linkId } : { status: 'unavailable' }
    } catch {
        return { status: 'unavailable' }
    }
}

async function isLinkNotFound(response: Response): Promise<boolean> {
    const body: unknown = await response.json().catch(() => null)
    return (
        !!body &&
        typeof body === 'object' &&
        Object.keys(body).length === 1 &&
        (body as { error?: unknown }).error === LINK_NOT_FOUND
    )
}
