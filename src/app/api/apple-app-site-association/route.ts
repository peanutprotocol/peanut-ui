import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as consts from '@/consts'

export async function GET(request: NextRequest) {
    const response = await fetch(`${consts.peanut_api_url}/apple-app-site-association`)
    const data = await response.json()
    return NextResponse.json(data, {
        status: 200,
    })
}
