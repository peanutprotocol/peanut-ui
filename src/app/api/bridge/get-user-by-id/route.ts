import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const { customerId } = await request.json()
        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const response = await fetchWithSentry(`https://api.bridge.xyz/v0/customers/${customerId}`, {
            method: 'GET',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                accept: 'application/json',
            },
        })

        const data = await response.json()

        if (!response.ok) {
            return new NextResponse(JSON.stringify(data), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to get customer data:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
