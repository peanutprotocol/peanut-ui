import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const customerId = url.searchParams.get('customerId')
        if (!customerId) {
            throw new Error('Customer ID is required')
        }

        const { accountType, accountDetails, address, accountOwnerName } = await request.json()

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

        const data = await response.json()

        if (!response.ok) {
            if (data.code && data.code == 'duplicate_external_account') {
                // in case the bridge account already exists
                //
                // sending back error responses is not currently common across app 
                // in how we deliver errors from backend -> frontend
                // sends back an object like:
                // {
                //     id: '4c537540-80bf-41dd-a528-dbe39a4',
                //     code: 'duplicate_external_account',
                //     message: 'An external account with the same information has already been added for this customer'
                //   }
                //
                // TODO: standardize error responses across backend
                return new NextResponse(JSON.stringify(data), {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            }
            throw new Error(`HTTP error! status: ${response.status}`)
        }

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
