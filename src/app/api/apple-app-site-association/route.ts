import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
    const response = await fetchWithSentry(`${PEANUT_API_URL}/apple-app-site-association`)
    const data = await response.json()
    return NextResponse.json(data, {
        status: 200,
    })
}
