import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, bridgeAccountId, accountType, accountIdentifier } = body

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
                bridgeAccountIdentifier: bridgeAccountId,
                accountType,
                accountIdentifier,
            }),
        })

        if (!response.ok) {
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
