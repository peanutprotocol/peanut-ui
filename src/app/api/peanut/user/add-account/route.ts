import * as consts from '@/constants'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, bridgeAccountIdentifier, accountType, accountIdentifier, connector } = body

        const apiKey = process.env.PEANUT_API_KEY!

        const cookieStore = cookies()
        const token = cookieStore.get('jwt-token')

        if (!apiKey || !accountType || !accountIdentifier || !userId || !token) {
            return new NextResponse('Bad Request: Missing required fields', { status: 400 })
        }

        const response = await fetch(`${consts.PEANUT_API_URL}/add-account`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
                Authorization: `Bearer ${token.value}`,
            },
            body: JSON.stringify({
                userId,
                bridgeAccountIdentifier,
                accountType,
                accountIdentifier,
                connector,
            }),
        })

        if (!response.ok) {
            if (response.status === 409) {
                return new NextResponse(JSON.stringify({ error: 'User already exists' }), {
                    status: 409,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            }
            throw new Error(`Failed to create user: ${response.status}`)
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
