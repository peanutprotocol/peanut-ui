import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const { source, destination, on_behalf_of, amount } = await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const idempotencyKey = uuidv4()

        const response = await fetch('https://api.bridge.xyz/v0/transfers', {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                source,
                destination,
                on_behalf_of,
                amount,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create transfer: ${response.status}`)
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
