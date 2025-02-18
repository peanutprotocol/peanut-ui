import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { customerId } = body

        if (!customerId) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Customer ID is required',
                    details: 'Missing customerId in request body',
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

        const response = await fetch(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
            method: 'GET',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                Accept: 'application/json',
            },
        })

        const data = await response.json()

        if (!response.ok) {
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Bridge API error',
                    details: data?.message || `Failed to fetch accounts: ${response.status} ${response.statusText}`,
                    status: response.status,
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Bridge API returns { data: Account[] }, we want to return just the array
        return new NextResponse(JSON.stringify(data.data || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error in get-all-for-customerId:', error)
        return new NextResponse(
            JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error occurred',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
