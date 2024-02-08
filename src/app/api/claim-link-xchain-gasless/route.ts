import type { NextRequest } from 'next/server'
import { claimLinkXChainGasless } from '@squirrel-labs/peanut-sdk'
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''
        console.log(body)

        const claimLinkGaslessResponse = await claimLinkXChainGasless({
            link: body.link,
            recipientAddress: body.recipientAddress,
            APIKey: APIKey,
            destinationChainId: body.destinationChainId,
            destinationToken: body.destinationToken,
            isMainnet: body.isMainnet,
            squidRouterUrl: body.squidRouterUrl,
            baseUrl: body.baseUrl,
        })

        return new Response(JSON.stringify(claimLinkGaslessResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in claimLinkXChainGasless Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
