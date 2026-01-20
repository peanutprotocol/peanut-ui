import { fetchWithSentry } from '@/utils/sentry.utils'
import type { BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { getJWTCookie } from '@/utils/cookie-migration.utils'

type UserPayload = {
    userId: string
    username?: string
    bridge_customer_id?: string
    bridgeKycStatus?: BridgeKycStatus
    telegramUsername?: string
    email?: string
    pushSubscriptionId?: string
    fullName?: string
}

export async function POST(request: NextRequest) {
    const { userId, username, bridge_customer_id, bridgeKycStatus, telegram, email, pushSubscriptionId, fullName } =
        await request.json()

    const apiKey = process.env.PEANUT_API_KEY
    const token = await getJWTCookie()

    if (!userId || !apiKey || !token) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const payload: UserPayload = {
            userId,
            username,
            bridge_customer_id,
            bridgeKycStatus: bridgeKycStatus,
        }

        if (telegram) {
            payload.telegramUsername = telegram
        }

        if (email) {
            payload.email = email
        }

        if (pushSubscriptionId) {
            payload.pushSubscriptionId = pushSubscriptionId
        }

        if (fullName) {
            payload.fullName = fullName
        }

        const response = await fetchWithSentry(`${PEANUT_API_URL}/update-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
            body: JSON.stringify(payload),
        })

        if (response.status === 404) {
            return new NextResponse('Not Found', {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        const data = await response.json()

        if (response.status === 409) {
            return new NextResponse(JSON.stringify(data.message), {
                status: 409,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        if (response.status !== 200) {
            return new NextResponse(JSON.stringify(data), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse(
            JSON.stringify({
                error: 'Internal Server Error',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500 }
        )
    }
}
