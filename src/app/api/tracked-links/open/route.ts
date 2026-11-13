import { after } from 'next/server'
import {
    MARKETING_QR_HEADERS,
    isAutomatedMarketingQrRequest,
    isMarketingQrAppOrigin,
    marketingQrAppCorsHeaders,
    readMarketingQrBody,
} from '@/features/marketing-qr/server'
import { captureTrackedLinkOpening, parseTrackedLinkOpening } from '@/features/tracked-links/capture'
import { lookupInviteLink } from '@/features/tracked-links/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
    const origin = new URL(request.url).origin
    const requestOrigin = request.headers.get('origin')
    const fromApp = isMarketingQrAppOrigin(requestOrigin)
    if (requestOrigin !== origin && !fromApp) return new Response(null, { status: 403, headers: MARKETING_QR_HEADERS })
    const headers = { ...MARKETING_QR_HEADERS, ...(fromApp ? marketingQrAppCorsHeaders(requestOrigin) : {}) }
    const body = await readMarketingQrBody(request)
    if (body.status !== 200) return new Response(null, { status: body.status, headers })
    const opening = parseTrackedLinkOpening(body.value)
    if (!opening) return new Response(null, { status: 400, headers })
    if (
        isAutomatedMarketingQrRequest(request.headers) ||
        request.headers.get('dnt') === '1' ||
        request.headers.get('sec-gpc') === '1'
    ) {
        return new Response(null, { status: 204, headers })
    }
    // The client names only the slug; the link ID in the event comes from the identity lookup.
    const lookup = await lookupInviteLink(opening.slug)
    if (lookup.status !== 'found')
        return new Response(null, { status: lookup.status === 'not_found' ? 404 : 503, headers })
    after(() => captureTrackedLinkOpening(opening, lookup.linkId, origin, fromApp ? 'app' : 'web'))
    return new Response(null, { status: 204, headers })
}

export function OPTIONS(request: Request): Response {
    const origin = request.headers.get('origin')
    if (!isMarketingQrAppOrigin(origin)) return unsupported()
    return new Response(null, {
        status: 204,
        headers: { ...MARKETING_QR_HEADERS, ...marketingQrAppCorsHeaders(origin) },
    })
}
function unsupported(): Response {
    return new Response(null, { status: 405, headers: { ...MARKETING_QR_HEADERS, Allow: 'POST' } })
}
export { unsupported as GET, unsupported as HEAD, unsupported as PUT, unsupported as PATCH, unsupported as DELETE }
