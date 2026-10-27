import { getMarketingQrRegistration, parseMarketingQrQuery } from '@/features/marketing-qr/contract'
import { renderMarketingQrHandoff } from '@/features/marketing-qr/handoff'
import { MARKETING_QR_HEADERS, isAutomatedMarketingQrRequest } from '@/features/marketing-qr/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ placement: string }> }

export async function GET(request: Request, context: RouteContext): Promise<Response> {
    if (request.url.length > 2048) return new Response(null, { status: 414, headers: MARKETING_QR_HEADERS })
    const { placement } = await context.params
    const registration = getMarketingQrRegistration(placement)
    if (!registration) return new Response(null, { status: 404, headers: MARKETING_QR_HEADERS })
    const attribution = parseMarketingQrQuery(registration, new URL(request.url).searchParams)
    const captureEnabled =
        attribution.valid &&
        !isAutomatedMarketingQrRequest(request.headers) &&
        request.headers.get('dnt') !== '1' &&
        request.headers.get('sec-gpc') !== '1'
    const { html, csp } = await renderMarketingQrHandoff(registration, attribution, captureEnabled)
    return new Response(html, {
        headers: {
            ...MARKETING_QR_HEADERS,
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': csp,
        },
    })
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
    const { placement } = await context.params
    return new Response(null, {
        status: request.url.length > 2048 ? 414 : getMarketingQrRegistration(placement) ? 200 : 404,
        headers: MARKETING_QR_HEADERS,
    })
}

function unsupported(): Response {
    return new Response(null, { status: 405, headers: { ...MARKETING_QR_HEADERS, Allow: 'GET, HEAD' } })
}
export { unsupported as POST, unsupported as PUT, unsupported as PATCH, unsupported as DELETE, unsupported as OPTIONS }
