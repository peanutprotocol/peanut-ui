import * as interfaces from '@/interfaces'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const customerId = url.searchParams.get('customerId')
        if (!customerId) {
            return new NextResponse(JSON.stringify({ success: false, message: 'Customer ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const requestData = await request.json()
        const { accountType, accountDetails, address, accountOwnerName } = requestData

        if (!process.env.BRIDGE_API_KEY) {
            return new NextResponse(JSON.stringify({ success: false, message: 'BRIDGE_API_KEY is not defined' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const idempotencyKey = uuidv4()
        let body

        if (accountType === 'iban') {
            body = {
                iban: {
                    account_number: accountDetails.accountNumber.replace(/\s+/g, '').toUpperCase(),
                    bic: accountDetails.bic.toUpperCase(),
                    country: accountDetails.country.toUpperCase(),
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
            return new NextResponse(JSON.stringify({ success: false, message: 'Invalid account type' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

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

        // Parse response as JSON directly
        const responseData = await response.json()

        if (!response.ok) {
            console.error('Bridge API request failed:', response.status, response.statusText, responseData)

            if (responseData?.details?.code === 'endorsement_requirements_not_met') {
                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        message: 'Additional verification required',
                        details: {
                            code: responseData.details.code,
                            message: responseData.message,
                            verificationUrl: responseData.requirements?.kyc_with_proof_of_address,
                        },
                    }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                )
            }

            if (responseData?.code === 'invalid_parameters') {
                const missingParams = Object.keys(responseData.source?.key || {})
                const errorMessage =
                    missingParams.length > 0
                        ? `Missing required fields: ${missingParams.map((p) => p.split('.').pop()).join(', ')}`
                        : responseData.message
                return new NextResponse(JSON.stringify({ success: false, message: errorMessage }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            if (responseData?.code === 'duplicate_external_account') {
                console.log('Duplicate account detected, fetching existing accounts')

                const allAccounts = await fetch(`/api/bridge/external-account/get-all-for-customerId`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId }),
                })

                if (!allAccounts.ok) {
                    return new NextResponse(
                        JSON.stringify({ success: false, message: 'Failed to fetch existing accounts' }),
                        { status: 500, headers: { 'Content-Type': 'application/json' } }
                    )
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
                    return new NextResponse(
                        JSON.stringify({ success: false, message: 'Could not find matching existing account' }),
                        { status: 404, headers: { 'Content-Type': 'application/json' } }
                    )
                }

                return new NextResponse(JSON.stringify({ success: true, data: existingAccount }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            }

            return new NextResponse(
                JSON.stringify({
                    success: false,
                    message: responseData?.message || 'Failed to create external account',
                    details: responseData,
                }),
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            )
        }

        return new NextResponse(JSON.stringify({ success: true, data: responseData }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Failed to create external account:', error)
        return new NextResponse(
            JSON.stringify({
                success: false,
                message: 'Internal Server Error',
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
