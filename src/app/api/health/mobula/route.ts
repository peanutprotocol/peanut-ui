import { NextResponse } from 'next/server'
import { getMobulaVerdict } from './mobula-probe'

export const dynamic = 'force-dynamic'

/** Health check for Mobula's price API — one cached verdict for every caller (see mobula-probe.ts). */
export async function GET() {
    const { httpStatus, body } = await getMobulaVerdict()
    return NextResponse.json(body, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } })
}
