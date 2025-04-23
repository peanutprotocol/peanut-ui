import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')

    if (!token) {
        return new NextResponse(JSON.stringify({ error: 'Not authenticated' }), { status: 401 })
    }

    try {
        cookieStore.delete('jwt-token')

        return new NextResponse(JSON.stringify({ success: true }), { status: 200 })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
