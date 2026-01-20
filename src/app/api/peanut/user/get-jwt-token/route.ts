import { fetchWithSentry } from '@/utils/sentry.utils'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'

export async function POST(request: NextRequest) {
    const { signature, message } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!signature || !message || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/get-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                signature: signature,
                message: message,
            }),
        })

        if (response.status != 200) {
            return new NextResponse('Error in get-jwt-token', {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const data = await response.json()
        const token = data.token

        // Set the JWT token in a cookie, nextjs requires to do this serverside
        const cookieStore = await cookies()
        cookieStore.set('jwt-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // consistent with other auth routes
            path: '/',
            sameSite: 'lax', // 'lax' allows cookies on top-level navigation while still preventing CSRF
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
