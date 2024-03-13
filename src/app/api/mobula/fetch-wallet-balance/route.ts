import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const API_KEY = process.env.MOBULA_API_KEY ?? ''

        if (!API_KEY) throw new Error('API_KEY not found in env')

        const mobulaResponse = await fetch(
            `https://api.mobula.io/api/1/wallet/portfolio?wallet=${body.address}&blockchains=${body.chainIds}&pnl=${body.pnl}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: API_KEY,
                },
            }
        )

        if (!mobulaResponse.ok) return new Response('Internal Server Error', { status: 500 })

        const mobulaResponseJson = await mobulaResponse.text()

        return new Response(mobulaResponseJson, {
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
