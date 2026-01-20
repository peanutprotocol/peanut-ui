import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { refreshJWTCookieIfNeeded } from '@/utils/cookie-migration.utils'

export async function GET(_request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    const apiKey = process.env.PEANUT_API_KEY

    if (!token || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }
    
    // Auto-migrate cookie from sameSite='strict' to 'lax'
    await refreshJWTCookieIfNeeded(token.value)
    
    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/get-user`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
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
