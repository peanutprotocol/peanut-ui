import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * TODO: Implement server-side token invalidation.
 * Currently logout only deletes the cookie; the JWT remains valid for 30 days.
 * Fix: Add tokenVersion to User table, include in JWT, increment on logout.
 */
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
