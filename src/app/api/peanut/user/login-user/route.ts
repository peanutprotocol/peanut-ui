import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'

export async function POST(request: NextRequest) {
    const { email, password, userId } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!email || !password || !userId || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/login-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({ email, password, userId }),
        })

        if (response.status !== 200) {
            return new NextResponse('Error in login-user', {
                status: response.status,
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
