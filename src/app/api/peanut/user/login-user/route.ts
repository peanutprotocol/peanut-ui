import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    const { email, hash } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!email || !hash || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/login-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({ email, pw_hash: hash }),
        })

        const data = await response.json()

        if (response.status !== 200) {
            return new NextResponse(JSON.stringify(data.error), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const token = data.token

        cookies().set('jwt-token', token, {
            httpOnly: true,
            path: '/',
            sameSite: 'strict',
        })

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
