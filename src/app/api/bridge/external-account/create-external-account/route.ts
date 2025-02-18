import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const { customerId, accountType, accountDetails, address, accountOwnerName } = await request.json()

        if (!customerId) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Customer ID is required',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        if (!process.env.BRIDGE_API_KEY) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Server configuration error',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const idempotencyKey = uuidv4()
        let body

        if (accountType === 'iban') {
            body = {
                iban: {
                    account_number: accountDetails.accountNumber.replace(/\s+/g, ''),
                    bic: accountDetails.bic,
                    country: accountDetails.country,
                },
                currency: 'eur',
                account_owner_name: accountOwnerName,
                account_type: 'iban',
                account_owner_type: 'individual',
                first_name: accountOwnerName.split(' ')[0],
                last_name: accountOwnerName.substring(accountOwnerName.indexOf(' ') + 1),
            }
        } else if (accountType === 'us') {
            body = {
                account: {
                    account_number: accountDetails.accountNumber,
                    routing_number: accountDetails.routingNumber,
                },
                address: {
                    street_line_1: address.street,
                    city: address.city,
                    country: address.country,
                    state: address.state,
                    postal_code: address.postalCode,
                },
                account_owner_name: accountOwnerName,
                account_type: 'us',
                account_owner_type: 'individual',
            }
        } else {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Invalid account type',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const response = await fetch(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()

        if (!response.ok) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: data.message || 'Failed to create external account',
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        return new NextResponse(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error creating external account:', error)
        return new NextResponse(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
