import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
    const cookieStore = cookies()
    const token = cookieStore.get('jwt-token')

    if (!token) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }
    try {
        const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/peanut/user/get-user`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ authToken: token.value }),
        })

        if (response.status !== 200) {
            return new NextResponse('Error in get-from-cookie', {
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
