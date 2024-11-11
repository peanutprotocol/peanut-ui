import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { IBridgeLiquidationAddress } from '@/interfaces'

export async function POST(request: NextRequest) {
    try {
        const { customer_id, chain, currency, external_account_id, destination_payment_rail, destination_currency } =
            await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            return NextResponse.json({ error: 'BRIDGE_API_KEY is not defined' }, { status: 500 })
        }

        const idempotencyKey = uuidv4()

        let response = await fetch(`https://api.bridge.xyz/v0/customers/${customer_id}/liquidation_addresses`, {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chain,
                currency,
                external_account_id,
                destination_payment_rail,
                destination_currency,
            }),
        })

        let data = await response.json()

        console.log('Bridge API Response:', {
            status: response.status,
            data: data,
        })

        if (!response.ok) {
            if (data.code === 'not_allowed' && data.message?.includes('does not own external account')) {
                return NextResponse.json(
                    {
                        error: 'external_account_mismatch',
                        details: data,
                    },
                    { status: 401 }
                )
            }

            return NextResponse.json(
                {
                    error: `Failed to create liquidation address: ${response.status}`,
                    details: data,
                },
                { status: response.status }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in liquidation-address/create:', error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Internal Server Error',
                details: error,
            },
            { status: 500 }
        )
    }
}
