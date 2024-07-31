import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
    const cookieStore = cookies()
    const token = cookieStore.get('jwt-token')

    if (!token) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const response = await fetch('http://localhost:3000/api/peanut/user/get-user', {
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
