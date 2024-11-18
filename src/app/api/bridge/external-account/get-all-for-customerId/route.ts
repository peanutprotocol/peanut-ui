import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { customerId } = await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const response = await fetch(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
            method: 'GET',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch data from Bridge API. Status: ${response.status}`)
        }

        const responseData = await response.json()

        // Bridge API returns { data: Account[] }, we want to return just the array
        const accounts = responseData.data || []

        return new NextResponse(JSON.stringify(accounts), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to fetch external accounts:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
