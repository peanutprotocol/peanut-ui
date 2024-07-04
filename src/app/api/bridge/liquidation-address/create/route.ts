import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { IBridgeLiquidationAddress } from '@/interfaces'

export async function POST(request: NextRequest) {
    try {
        const { customer_id, chain, currency, external_account_id, destination_payment_rail, destination_currency } =
            await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const idempotencyKey = uuidv4()

        console.log('Request:', {
            customer_id,
            chain,
            currency,
            external_account_id,
            destination_payment_rail,
            destination_currency,
        })

        const response = await fetch(`https://api.bridge.xyz/v0/customers/${customer_id}/liquidation_addresses`, {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                accept: 'application/json',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                chain,
                currency,
                external_account_id,
                destination_payment_rail,
                destination_currency,
            }),
        })

        console.log('Response:', response)

        if (!response.ok) {
            throw new Error(`Failed to create liquidation address: ${response.status}`)
        }

        const data: IBridgeLiquidationAddress = await response.json()

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
