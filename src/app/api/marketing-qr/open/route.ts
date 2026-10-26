import { after } from 'next/server'
import {
    MARKETING_QR_HEADERS,
    captureMarketingQrOpening,
    isAutomatedMarketingQrRequest,
    parseMarketingQrOpening,
    readMarketingQrBody,
} from '@/features/marketing-qr/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
    const origin = new URL(request.url).origin
    if (request.headers.get('origin') !== origin)
        return new Response(null, { status: 403, headers: MARKETING_QR_HEADERS })
    const body = await readMarketingQrBody(request)
    if (body.status !== 200) return new Response(null, { status: body.status, headers: MARKETING_QR_HEADERS })
    const opening = parseMarketingQrOpening(body.value)
    if (!opening) return new Response(null, { status: 400, headers: MARKETING_QR_HEADERS })
    if (
        !isAutomatedMarketingQrRequest(request.headers) &&
        request.headers.get('dnt') !== '1' &&
        request.headers.get('sec-gpc') !== '1'
    ) {
        after(() => captureMarketingQrOpening(opening, origin))
    }
    return new Response(null, { status: 204, headers: MARKETING_QR_HEADERS })
}

function unsupported(): Response {
    return new Response(null, { status: 405, headers: { ...MARKETING_QR_HEADERS, Allow: 'POST' } })
}
export {
    unsupported as GET,
    unsupported as HEAD,
    unsupported as PUT,
    unsupported as PATCH,
    unsupported as DELETE,
    unsupported as OPTIONS,
}
