import { acquisitionHandoffPath } from '@/features/tracked-links/contract'
import { resolveAcquisitionLink, TRACKED_LINK_HEADERS } from '@/features/tracked-links/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(request: Request, context: RouteContext): Promise<Response> {
    if (request.url.length > 2048) return new Response(null, { status: 414, headers: TRACKED_LINK_HEADERS })
    const { slug } = await context.params
    // Incoming query parameters never override a registered campaign, owner, revision or destination.
    const result = await resolveAcquisitionLink(slug)
    if (result.status !== 200) {
        if (result.status === 503)
            return new Response(null, {
                status: 307,
                headers: { ...TRACKED_LINK_HEADERS, Location: '/home?app_entry=1' },
            })
        return new Response(result.status === 410 ? 'This link is no longer active.' : 'Link not found.', {
            status: result.status,
            headers: TRACKED_LINK_HEADERS,
        })
    }
    // Marketing QR keeps its existing personless handoff, transport and event. There is no journey join.
    const destination =
        result.link.kind === 'marketing_qr'
            ? `/home?mqr=${encodeURIComponent(result.link.qr.id)}`
            : acquisitionHandoffPath(result.link)
    return new Response(null, { status: 307, headers: { ...TRACKED_LINK_HEADERS, Location: destination } })
}
export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
    const result = await GET(request, context)
    return new Response(null, { status: result.status, headers: result.headers })
}
