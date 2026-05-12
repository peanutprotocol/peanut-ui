import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils/sentry.utils'

// Matches `export const maxDuration = 300` on the proxy route handlers — the
// upstream wait budget should not be shorter than the function's own runtime
// budget. `fetchWithSentry`'s default is 10 s, which silently turned every
// >10 s upstream call (Manteca QR pay, withdraw, anything that polls a
// provider) into a bare 500 even though the API was still processing.
const PROXY_UPSTREAM_TIMEOUT_MS = 300_000

export async function proxyUpstream(url: string, init: RequestInit): Promise<Response> {
    return fetchWithSentry(url, init, PROXY_UPSTREAM_TIMEOUT_MS)
}

export function upstreamErrorResponse(error: unknown, url: string): NextResponse {
    const isAbort = error instanceof Error && (error.name === 'AbortError' || /timed out/i.test(error.message))
    const status = isAbort ? 504 : 502
    const body = {
        error: isAbort ? 'Upstream timeout' : 'Upstream unreachable',
        message: isAbort
            ? 'The upstream request took too long. The action may still have succeeded — check your history before retrying.'
            : 'Could not reach the upstream API.',
        url,
    }
    return NextResponse.json(body, { status })
}
