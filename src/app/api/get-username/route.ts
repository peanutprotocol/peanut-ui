import type { NextRequest } from 'next/server'
import { getUsername } from '@squirrel-labs/peanut-sdk'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''

        console.log(body)

        const senderName = await getUsername({
            address: body.senderAddress,
            APIKey: APIKey,
            link: body.link,
        })

        return new Response(JSON.stringify(senderName), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in getUsername Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
