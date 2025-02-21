import type { NextRequest } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const projectID = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? ''

        if (!projectID) throw new Error('API_KEY not found in env')

        const apiResponse = await fetchWithSentry(
            `https://rpc.walletconnect.com/v1/account/${body.address}/balance?currency=usd&projectId=${projectID}`,
            {
                method: 'GET',
                // mode: 'no-cors', // Enable this locally
                headers: {
                    'Content-Type': 'application/json',
                    'x-sdk-version': '4.1.5',
                },
            }
        )

        if (!apiResponse.ok) return new Response('Internal Server Error', { status: 500 })

        const apiResponseJson = await apiResponse.text()

        return new Response(apiResponseJson, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in fetching wallet balance:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
