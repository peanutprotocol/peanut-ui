import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const { type, full_name, email } = await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }
        console.log(type, full_name, email)

        const idempotencyKey = uuidv4()

        console.log(idempotencyKey)

        const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                type,
                full_name,
                email,
            }),
        })

        console.log(response)

        if (!response.ok) {
            console.log(response)
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to create KYC link:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
