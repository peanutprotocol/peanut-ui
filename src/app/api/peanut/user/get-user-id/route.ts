import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    const { accountIdentifier } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!accountIdentifier || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/get-user-id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({ accountIdentifier }),
        })

        const data = await response.json()
        return new NextResponse(data ? JSON.stringify(data) : 'Error in get-user-id', {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
