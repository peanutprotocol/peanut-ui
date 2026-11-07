import { after } from 'next/server'
import {
    MARKETING_QR_HEADERS,
    captureMarketingQrOpening,
    isAutomatedMarketingQrRequest,
    isMarketingQrAppOrigin,
    marketingQrAppCorsHeaders,
    parseMarketingQrOpening,
    readMarketingQrBody,
} from '@/features/marketing-qr/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
    const origin = new URL(request.url).origin
    const requestOrigin = request.headers.get('origin')
    const fromApp = isMarketingQrAppOrigin(requestOrigin)
    if (requestOrigin !== origin && !fromApp) return new Response(null, { status: 403, headers: MARKETING_QR_HEADERS })
    const headers = fromApp
        ? { ...MARKETING_QR_HEADERS, ...marketingQrAppCorsHeaders(requestOrigin) }
        : MARKETING_QR_HEADERS
    const body = await readMarketingQrBody(request)
    if (body.status !== 200) return new Response(null, { status: body.status, headers })
    const opening = parseMarketingQrOpening(body.value)
    if (!opening) return new Response(null, { status: 400, headers })
    if (
        !isAutomatedMarketingQrRequest(request.headers) &&
        request.headers.get('dnt') !== '1' &&
        request.headers.get('sec-gpc') !== '1'
    ) {
        after(() => captureMarketingQrOpening(opening, origin, fromApp ? 'app' : 'web'))
    }
    return new Response(null, { status: 204, headers })
}

/** Only the apps' cross-origin POST needs a preflight; every other origin keeps 405. */
export function OPTIONS(request: Request): Response {
    const requestOrigin = request.headers.get('origin')
    if (!isMarketingQrAppOrigin(requestOrigin)) return unsupported()
    return new Response(null, {
        status: 204,
        headers: { ...MARKETING_QR_HEADERS, ...marketingQrAppCorsHeaders(requestOrigin) },
    })
}

function unsupported(): Response {
    return new Response(null, { status: 405, headers: { ...MARKETING_QR_HEADERS, Allow: 'POST' } })
}
export { unsupported as GET, unsupported as HEAD, unsupported as PUT, unsupported as PATCH, unsupported as DELETE }
