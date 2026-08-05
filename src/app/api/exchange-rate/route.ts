import { NextRequest, NextResponse } from 'next/server'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'

const NO_STORE = { 'Cache-Control': 'no-store' }

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
                    'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                },
            }
        )
    } catch (error) {
        if (error instanceof FxApiError && (error.status === 400 || error.status === 404)) {
            return NextResponse.json(
                { error: 'Exchange rate unavailable' },
                { status: error.status, headers: NO_STORE }
            )
        }
        console.error(`Exchange rate API error for ${from}-${to}:`, error)
        return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500, headers: NO_STORE })
    }
}
