import { parseAcquisitionRevision } from '@/features/tracked-links/contract'
import { resolveAcquisitionLink, TRACKED_LINK_HEADERS } from '@/features/tracked-links/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type RouteContext = { params: Promise<{ slug: string }> }
const APP_ORIGINS = new Set(['capacitor://localhost', 'https://localhost'])
function cors(request: Request): Record<string, string> {
    const origin = request.headers.get('origin')
    return origin && APP_ORIGINS.has(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' }
        : {}
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
    const headers = { ...TRACKED_LINK_HEADERS, ...cors(request) }
    const params = new URL(request.url).searchParams
    const rawRevision = params.get('revision')
    const revision = rawRevision === null ? undefined : parseAcquisitionRevision(rawRevision)
    if (
        request.url.length > 2048 ||
        revision === null ||
        params.getAll('revision').length > 1 ||
        [...params.keys()].some((key) => key !== 'revision')
    )
        return new Response(null, { status: 400, headers })
    const { slug } = await context.params
    const result = await resolveAcquisitionLink(slug, revision)
    return result.status === 200
        ? Response.json(result.link, { headers })
        : new Response(null, { status: result.status, headers })
}
export function OPTIONS(request: Request): Response {
    const headers = cors(request)
    return new Response(null, {
        status: Object.keys(headers).length ? 204 : 403,
        headers: { ...TRACKED_LINK_HEADERS, ...headers },
    })
}
