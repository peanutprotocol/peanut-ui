import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    const { signature, message } = await request.json()
    const apiKey = process.env.PEANUT_API_KEY

    if (!signature || !message || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetch('https://api.staging.peanut.to/get-token', {
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

        if (response.status === 404) {
            return new NextResponse('Not Found', {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const data = await response.json()
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
