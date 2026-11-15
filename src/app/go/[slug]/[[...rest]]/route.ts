import { bareGoVisit, goHandoffPath, isAcquisitionSlug, parseGoRequest } from '@/features/tracked-links/contract'
import { lookupInviteLink, TRACKED_LINK_HEADERS } from '@/features/tracked-links/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string; rest?: string[] }> }
): Promise<Response> {
    const { slug, rest } = await context.params
    // No case redirect: it would drop the query and the referrer, and /go is never indexed.
    const username = slug.toLowerCase()
    if (!isAcquisitionSlug(username)) return notFound()
    const lookup = await lookupInviteLink(username)
    if (lookup.status === 'not_found') return notFound()
    // An unavailable identity service still reaches the store, without claiming attribution.
    return redirect(lookup.status === 'found' ? handoffPath(request, username, rest) : '/home?app_entry=1')
}

/** A bug in tag parsing may lose the tags, never the creator: it falls back to the untagged handoff. */
function handoffPath(request: Request, username: string, rest: string[] = []): string {
    try {
        const visit = parseGoRequest(request, username, rest)
        if (visit) return goHandoffPath(visit)
    } catch {}
    return goHandoffPath(bareGoVisit(username))
}

function redirect(location: string): Response {
    return new Response(null, { status: 307, headers: { ...TRACKED_LINK_HEADERS, Location: location } })
}

function notFound(): Response {
    return new Response('Link not found.', { status: 404, headers: TRACKED_LINK_HEADERS })
}
