import type { NextRequest } from 'next/server'
import { getRaffleLinkFromTx } from '@squirrel-labs/peanut-sdk'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''

        console.log(body)

        const getLinkFromTxResponse = await getRaffleLinkFromTx({
            password: body.password,
            txHash: body.txHash,
            linkDetails: body.linkDetails,
            creatorAddress: body.creatorAddress,
            APIKey: APIKey,
            numberOfLinks: body.numberOfLinks,
            provider: body?.provider ?? undefined,
            name: body?.name ?? '',
        })

        return new Response(JSON.stringify(getLinkFromTxResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in getRaffleLinkFromTx Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
