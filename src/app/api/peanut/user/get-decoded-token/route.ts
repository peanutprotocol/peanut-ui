import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import * as consts from '@/constants'

export async function GET() {
    try {
        const cookieStore = cookies()
        const token = cookieStore.get('jwt-token')

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const decodedToken = parseJwt(token.value)
        return new NextResponse(JSON.stringify(decodedToken), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.log('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}

function parseJwt(token: string) {
    if (!token) {
        return
    }
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    return JSON.parse(decoded)
}
