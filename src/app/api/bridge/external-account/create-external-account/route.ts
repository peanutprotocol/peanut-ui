import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        // parse request body
        let requestBody
        try {
            requestBody = await request.json()
        } catch (error) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Invalid request body',
                    details: 'Failed to parse request body as JSON',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const { customerId, accountType, accountDetails, address, accountOwnerName } = requestBody

        // validate required fields
        if (!customerId) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Missing required parameter',
                    details: 'customerId is required in request body',
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
                    details: 'Bridge API key is not configured',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const idempotencyKey = uuidv4()
        let body

        // Prepare request body based on account type
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
                address,
                account_owner_name: accountOwnerName,
                account_type: 'us',
                account_owner_type: 'individual',
            }
        } else {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Invalid account type',
                    details: 'Account type must be either "iban" or "us"',
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
                    error: 'Bridge API error',
                    message: data.message || 'Failed to create external account',
                    details: {
                        status: response.status,
                        code: data.code,
                        requirements: data.requirements,
                        additionalInfo: data.details,
                    },
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        return new NextResponse(
            JSON.stringify({
                success: true,
                data: data,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    } catch (error) {
        console.error('Error in create-external-account:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        })

        return new NextResponse(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: {
                    message: error instanceof Error ? error.message : 'Unknown error occurred',
                    type: error instanceof Error ? error.name : typeof error,
                    ...(process.env.NODE_ENV === 'development' && {
                        stack: error instanceof Error ? error.stack : undefined,
                    }),
                },
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
