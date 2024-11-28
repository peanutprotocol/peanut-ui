import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import * as interfaces from '@/interfaces'

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const customerId = url.searchParams.get('customerId')
        if (!customerId) {
            throw new Error('Customer ID is required')
        }

        const requestData = await request.json()
        const { accountType, accountDetails, address, accountOwnerName } = requestData

        console.log('Creating external account with:', {
            customerId,
            accountType,
            accountDetails,
            address,
            accountOwnerName,
        })

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
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
            throw new Error('Invalid account type')
        }

        console.log('Sending request to Bridge API:', {
            url: `https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`,
            method: 'POST',
            headers: {
                'Idempotency-Key': idempotencyKey,
                'Api-Key': '[REDACTED]',
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const response = await fetch(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
            method: 'POST',
            headers: {
                'Idempotency-Key': idempotencyKey,
                'Api-Key': process.env.BRIDGE_API_KEY,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const responseText = await response.text()
        console.log('Bridge API Response:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseText,
        })

        if (!response.ok) {
            const responseText = await response.text()
            console.log('Error response text:', responseText)

            try {
                const errorData = JSON.parse(responseText)
                console.error('Bridge API error:', errorData)

                if (errorData.code === 'invalid_parameters') {
                    const missingParams = Object.keys(errorData.source?.key || {})
                    const errorMessage =
                        missingParams.length > 0
                            ? `Missing required fields: ${missingParams.map((p) => p.split('.').pop()).join(', ')}`
                            : errorData.message
                    return new NextResponse(
                        JSON.stringify({
                            success: false,
                            message: errorMessage,
                        }),
                        {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        }
                    )
                }

                if (errorData.code === 'duplicate_external_account') {
                    console.log('Duplicate account detected, fetching existing accounts')
                    const allAccounts = await fetch(`/api/bridge/external-account/get-all-for-customerId`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            customerId,
                        }),
                    })

                    if (!allAccounts.ok) {
                        throw new Error('Failed to fetch existing accounts')
                    }

                    const accounts = await allAccounts.json()
                    console.log('Found existing accounts:', accounts)

                    const existingAccount = accounts.find((account: interfaces.IBridgeAccount) => {
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
                        throw new Error('Could not find matching existing account')
                    }

                    console.log('Found matching existing account:', existingAccount)
                    return new NextResponse(
                        JSON.stringify({
                            success: true,
                            data: existingAccount,
                        }),
                        {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        }
                    )
                }

                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        message: errorData.message || 'Failed to create external account',
                        details: errorData,
                    }),
                    {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    }
                )
            } catch (e) {
                console.error('Error parsing Bridge API error response:', e)
                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        message: 'Failed to process Bridge API response',
                        details: responseText,
                    }),
                    {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    }
                )
            }
        }

        const data = JSON.parse(responseText)
        console.log('Successfully created external account:', data)

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to create external account:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
