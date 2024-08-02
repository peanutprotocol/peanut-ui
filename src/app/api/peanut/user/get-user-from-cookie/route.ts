import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const cookieStore = cookies()
    const token = cookieStore.get('jwt-token')

    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { protocol, hostname, port } = new URL(request.url)
    const apiUrl = `${protocol}//${hostname}:${port}/api/peanut/user/get-user`

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authToken: token.value }),
    })

    if (response.ok) {
        const userData = await response.json()
        return NextResponse.json(userData)
    }

    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
}
