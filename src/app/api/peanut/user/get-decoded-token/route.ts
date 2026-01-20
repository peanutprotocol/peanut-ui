import { NextResponse } from 'next/server'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

export async function GET() {
    try {
        const token = await getJWTCookie()

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
    try {
        const base64Url = token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const decoded = Buffer.from(base64, 'base64').toString('utf-8')
        return JSON.parse(decoded)
    } catch (error) {
        console.error('Failed to parse JWT:', error)
        return null
    }
}
