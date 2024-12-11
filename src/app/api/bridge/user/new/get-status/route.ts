import { NextResponse, NextRequest } from 'next/server'
import * as interfaces from '@/interfaces'
import { GET as getUserFromCookie } from '@/app/api/peanut/user/get-user-from-cookie/route'

export async function POST(request: NextRequest) {
    try {
        const { userId, type } = await request.json()
        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const getUserFromCookieRequest = new NextRequest('/api/peanut/user/get-user-from-cookie', {
            method: 'GET',
            headers: {
                cookie: request.cookies.toString(),
                ...request.headers,
            },
        })
        const getUserFromCookieResponse = await getUserFromCookie(getUserFromCookieRequest)
        if (!getUserFromCookieResponse.ok) {
            return new NextResponse('Unauthorized', { status: 401 })
        }
        const { user } = await getUserFromCookieResponse.json()

        if (userId !== user?.id) {
            return new NextResponse('Forbidden', { status: 403 })
        }

        const response = await fetch(`https://api.bridge.xyz/v0/kyc_links/${userId}`, {
            method: 'GET',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: interfaces.KYCData = await response.json()

        if (type === 'tos') {
            return new NextResponse(JSON.stringify({ tos_status: data.tos_status }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        } else if (type === 'kyc') {
            return new NextResponse(JSON.stringify({ kyc_status: data.kyc_status }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        } else if (type === 'customer_id') {
            return new NextResponse(JSON.stringify({ customer_id: data.customer_id }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }
    } catch (error) {
        console.error('Failed to get KYC status:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
