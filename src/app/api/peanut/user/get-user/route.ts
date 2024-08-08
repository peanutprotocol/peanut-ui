import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'

export async function POST(request: NextRequest) {
    const { authToken } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!authToken || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/get-user`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`,
                'api-key': apiKey,
            },
        })

        if (response.status === 404) {
            return new NextResponse('Not Found', {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const data = await response.json()
        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
