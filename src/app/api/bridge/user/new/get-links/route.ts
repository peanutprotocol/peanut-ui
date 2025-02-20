import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const { type, full_name, email } = await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        // Generate a unique idempotency key
        const idempotencyKey = uuidv4()

        // Make a POST request to create a new user
        const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type,
                full_name,
                email,
            }),
        })

        const data = await response.json()

        // handle duplicate users
        if (data.code === 'duplicate_record' && data.existing_kyc_link) {
            return new NextResponse(JSON.stringify(data.existing_kyc_link), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        if (!data.id) {
            return new NextResponse(JSON.stringify({ error: 'Failed to create Bridge customer' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Failed to create or retrieve KYC link:', error)
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
