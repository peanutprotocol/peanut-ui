import { NextRequest, NextResponse } from 'next/server'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'

const NO_STORE = { 'Cache-Control': 'no-store' }
const PASSTHROUGH_STATUSES = new Set([400, 404, 429, 503])

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Validate required parameters. ISO-4217 codes plus a couple of internal 4-letter
    // tickers (PUSD); reject anything else so downstream logs can't carry CRLF or
    // other control characters from arbitrary query input.
    const ISO_CODE = /^[A-Za-z]{3,4}$/
    if (!from || !to || !ISO_CODE.test(from) || !ISO_CODE.test(to)) {
        return NextResponse.json(
            { error: 'Missing or invalid parameters: from and to' },
            { status: 400, headers: NO_STORE }
        )
    }

    try {
        const rate = await fetchDisplayRate(from, to)
        return NextResponse.json(
            { rate },
            {
                headers: {
                    'Cache-Control': 's-maxage=300',
                },
            }
        )
    } catch (error) {
        if (error instanceof FxApiError && PASSTHROUGH_STATUSES.has(error.status)) {
            const headers: Record<string, string> = { ...NO_STORE }
            if (error.status === 429 && error.retryAfter) headers['Retry-After'] = error.retryAfter
            return NextResponse.json(
                {
                    error:
                        error.status >= 500 || error.status === 429
                            ? 'Exchange rate temporarily unavailable'
                            : 'Exchange rate unavailable',
                },
                { status: error.status, headers }
            )
        }
        console.error(`Exchange rate API error for ${from}-${to}:`, error)
        return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500, headers: NO_STORE })
    }
}
