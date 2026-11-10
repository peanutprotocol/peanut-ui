import { after } from 'next/server'
import {
    MARKETING_QR_HEADERS,
    isAutomatedMarketingQrRequest,
    isMarketingQrAppOrigin,
    marketingQrAppCorsHeaders,
    readMarketingQrBody,
} from '@/features/marketing-qr/server'
import { parseTrackedLinkOpening, captureTrackedLinkOpening } from '@/features/tracked-links/capture-server'
import { resolveAcquisitionLink } from '@/features/tracked-links/server'

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
    const resolved = await resolveAcquisitionLink(opening.slug, opening.revision)
    if (resolved.status !== 200) return new Response(null, { status: resolved.status, headers })
    if (resolved.link.policy !== 'journey') return new Response(null, { status: 400, headers })
    after(() => captureTrackedLinkOpening(opening, resolved.link, origin, fromApp ? 'app' : 'web'))
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
