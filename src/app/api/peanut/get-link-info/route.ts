import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'

export async function POST(request: NextRequest) {
    try {
        const { link } = await request.json()

        const response = await fetch(`${consts.PEANUT_API_URL}/get-link-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                link,
                apiKey: process.env.PEANUT_API_KEY,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error fetching user stats:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
