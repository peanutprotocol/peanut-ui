import { PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

export async function GET(_request: NextRequest) {
    const token = await getJWTCookie()
    const apiKey = process.env.PEANUT_API_KEY

    if (!token || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/get-user`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
        })

        if (response.status !== 200) {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }

            // on auth failure, clear the jwt cookie and sw cache so the client
            // can recover even if running old cached code
            if (response.status === 401) {
                headers['Set-Cookie'] = 'jwt-token=; Path=/; Max-Age=0; SameSite=Lax'
                headers['Clear-Site-Data'] = '"cache"'
            }

            return new NextResponse('Error in get-from-cookie', {
                status: response.status,
                headers,
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
