import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    const cookieStore = cookies()
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
