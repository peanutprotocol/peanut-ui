import type { NextRequest } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const API_KEY = process.env.MOBULA_API_KEY ?? ''

        if (!API_KEY) throw new Error('API_KEY not found in env')

        const mobulaResponse = await fetchWithSentry(
            `https://api.mobula.io/api/1/market/data?asset=${body.tokenAddress}&blockchain=${body.chainId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: API_KEY,
                },
            }
        )

        const mobulaResponseJson = await mobulaResponse.text()

        return new Response(mobulaResponseJson, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in fetching token price:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}
