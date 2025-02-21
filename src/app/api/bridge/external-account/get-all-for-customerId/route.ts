import { NextRequest, NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        // parse request body
        let body
        try {
            body = await request.json()
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

        const { customerId } = body

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

        const response = await fetchWithSentry(`https://api.bridge.xyz/v0/customers/${customerId}/external_accounts`, {
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
                    details: {
                        status: response.status,
                        message: data?.message || response.statusText,
                        code: data?.code,
                        additionalInfo: data?.details || data?.requirements,
                    },
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // Bridge API returns { data: Account[] }, we want to return just the array
        return new NextResponse(
            JSON.stringify({
                success: true,
                data: data.data || [],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    } catch (error) {
        console.error('Error in get-all-for-customerId:', {
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
