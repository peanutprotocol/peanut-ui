import type { NextRequest } from 'next/server'
import { claimRaffleLink } from '@squirrel-labs/peanut-sdk'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''
        console.log(body)

        const raffleClaimedInfo = await claimRaffleLink({
            link: body.link,
            APIKey: APIKey,
            recipientAddress: body.recipientAddress,
            recipientName: body.recipientName,
        })

        return new Response(JSON.stringify(raffleClaimedInfo), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in claimRaffleLink Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
