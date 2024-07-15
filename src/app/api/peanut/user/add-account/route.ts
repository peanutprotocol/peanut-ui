import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, bridgeCustomerId, bridgeAccountId, accountType, accountIdentifier, accountDetails } = body

        const apiKey = process.env.PEANUT_API_KEY!

        if (!apiKey || !bridgeCustomerId || !bridgeAccountId || !accountType || !accountIdentifier || !userId) {
            return new NextResponse('Bad Request: Missing required fields', { status: 400 })
        }

        const response = await fetch(`https://api.staging.peanut.to/user/create-account`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                userId,
                bridgeCustomerId,
                bridgeAccountId,
                accountType,
                accountIdentifier,
                accountDetails,
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
