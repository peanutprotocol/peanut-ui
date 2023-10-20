import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export async function GET(request: NextRequest) {
    const response = await fetch('https://api.peanut.to/AASA')
    const data = await response.json()
    return NextResponse.json(data, {
        status: 200,
    })
}
