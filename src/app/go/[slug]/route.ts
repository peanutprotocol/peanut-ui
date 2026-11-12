import { acquisitionHandoffPath, isAcquisitionSlug } from '@/features/tracked-links/contract'
import { lookupInviteLink, TRACKED_LINK_HEADERS } from '@/features/tracked-links/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
    const { slug } = await context.params
    const canonical = slug.toLowerCase()
    if (!isAcquisitionSlug(canonical)) return notFound()
    // Usernames are lowercase; a creator typing their own name capitalised still gets one canonical URL.
    if (canonical !== slug) return redirect(308, `/go/${canonical}`)
    // Incoming query parameters never select the inviter or the destination.
    const lookup = await lookupInviteLink(slug)
    if (lookup.status === 'not_found') return notFound()
    // An unavailable identity service still reaches the store, without claiming attribution.
    return redirect(307, lookup.status === 'found' ? acquisitionHandoffPath(slug) : '/home?app_entry=1')
}

function redirect(status: 307 | 308, location: string): Response {
    return new Response(null, { status, headers: { ...TRACKED_LINK_HEADERS, Location: location } })
}

function notFound(): Response {
    return new Response('Link not found.', { status: 404, headers: TRACKED_LINK_HEADERS })
}
