import { IBridgeAccount } from '@/interfaces'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { fetchWithSentry } from '@/utils'

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

        const { accountType, accountDetails, address, accountOwnerName } = requestBody

        const url = new URL(request.url)
        const customerId = url.searchParams.get('customerId')

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
                    details: 'Account type must be either "iban" or "us"',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const response = await fetchWithSentry(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
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
            if (data.code === 'invalid_parameters') {
                const missingParams = Object.keys(data.source?.key || {})
                const errorMessage =
                    missingParams.length > 0
                        ? `Missing required fields: ${missingParams.map((p) => p.split('.').pop()).join(', ')}`
                        : data.message

                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        error: 'Bridge API error',
                        message: errorMessage || 'Failed to create external account',
                        details: data,
                    }),
                    {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    }
                )
            }

            if (data.code === 'duplicate_external_account') {
                console.log('Duplicate account detected, fetching existing accounts')

                const bridgeResponse = await fetchWithSentry(
                    `https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`,
                    {
                        method: 'GET',
                        headers: {
                            'Api-Key': process.env.BRIDGE_API_KEY!,
                            Accept: 'application/json',
                        },
                    }
                )

                if (!bridgeResponse.ok) {
                    console.error('Failed to fetch existing accounts:', {
                        status: bridgeResponse.status,
                        statusText: bridgeResponse.statusText,
                    })

                    const errorData = await bridgeResponse.json().catch(() => ({}))
                    return new NextResponse(
                        JSON.stringify({
                            success: false,
                            error: 'Failed to fetch existing accounts',
                            details: {
                                status: bridgeResponse.status,
                                message: errorData.message || bridgeResponse.statusText,
                                code: errorData.code,
                            },
                        }),
                        {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' },
                        }
                    )
                }

                const bridgeData = await bridgeResponse.json()
                console.log('Found existing accounts:', bridgeData)

                // Bridge API returns { data: Account[] }
                const accounts = bridgeData.data || []

                const existingAccount = accounts.find((account: IBridgeAccount) => {
                    if (accountType === 'iban') {
                        return (
                            account.account_details.type === 'iban' &&
                            account.account_details.last_4 === accountDetails.accountNumber.slice(-4)
                        )
                    } else {
                        return (
                            account.account_details.type === 'us' &&
                            account.account_details.last_4 === accountDetails.accountNumber.slice(-4) &&
                            account.account_details.routing_number === accountDetails.routingNumber
                        )
                    }
                })

                if (!existingAccount) {
                    return new NextResponse(
                        JSON.stringify({
                            success: false,
                            error: 'Account not found',
                            details: 'Could not find matching existing account',
                        }),
                        {
                            status: 404,
                            headers: { 'Content-Type': 'application/json' },
                        }
                    )
                }

                console.log('Found matching existing account:', existingAccount)

                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        data: existingAccount,
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }
                )
            }

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

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
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
