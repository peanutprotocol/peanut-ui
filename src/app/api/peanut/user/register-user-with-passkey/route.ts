import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    const { username } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!username) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/register-user-with-passkey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({ username }),
        })
        const data = await response.json()

        if (response.status !== 200) {
            return new NextResponse(
                JSON.stringify({
                    error: data.error,
                    userId: data.userId,
                }),
                {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )
        }

        const token = data.token

        // Set the JWT token in a cookie, nextjs requires to do this serverside
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
