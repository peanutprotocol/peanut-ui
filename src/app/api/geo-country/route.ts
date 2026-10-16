import { NextRequest, NextResponse } from 'next/server'
import { normalizeCountrySignal } from '@/utils/country-signal'

// Native static exports call the deployed web endpoint. No credentials or
// personal identifiers are needed: only the requesting IP's country is returned.
export async function GET(request: NextRequest) {
    return NextResponse.json(
        { country: normalizeCountrySignal(request.headers.get('x-vercel-ip-country')) },
        { headers: { 'Cache-Control': 'private, no-store', 'Access-Control-Allow-Origin': '*' } }
    )
}
