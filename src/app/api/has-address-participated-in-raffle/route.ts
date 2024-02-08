import type { NextRequest } from 'next/server'
import { hasAddressParticipatedInRaffle } from '@squirrel-labs/peanut-sdk'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''

        console.log(body)

        const hasAddressParticipatedInRaffleResponse = await hasAddressParticipatedInRaffle({
            link: body.link,
            address: body.address,
            APIKey: APIKey,
        })

        return new Response(JSON.stringify(hasAddressParticipatedInRaffleResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in hasAddressParticipatedInRaffle Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
