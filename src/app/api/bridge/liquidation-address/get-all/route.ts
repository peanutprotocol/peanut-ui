import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { IBridgeLiquidationAddress } from '@/interfaces'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const customerId = searchParams.get('customerId')

        if (!customerId) {
            return new NextResponse('Bad Request: customerId is required', { status: 400 })
        }

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        const uniqueParam = `t=${new Date().getTime()}`
        const response = await fetch(
            `https://api.bridge.xyz/v0/customers/${customerId}/liquidation_addresses?${uniqueParam}`,
            {
                method: 'GET',
                headers: {
                    'Api-Key': process.env.BRIDGE_API_KEY,
                    accept: 'application/json',
                },
            }
        )

        const jsonResponse = await response.json()

        if (!response.ok) {
            throw new Error(`Failed to fetch liquidation addresses: ${response.status}`)
        }

        const data: IBridgeLiquidationAddress[] = jsonResponse.data

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
