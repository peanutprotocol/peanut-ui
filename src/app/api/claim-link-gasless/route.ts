// app/api/getRaffleLeaderboard.ts

import type { NextRequest } from 'next/server'
import { claimLinkGasless } from '@squirrel-labs/peanut-sdk' // Adjust the import path

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? '' // Securely stored in environment variables
        console.log(body)

        const claimLinkGaslessResponse = await claimLinkGasless({
            link: body.link,
            recipientAddress: body.recipientAddress,
            APIKey: APIKey ?? '',
            baseUrl: body.baseUrl,
        })

        return new Response(JSON.stringify(claimLinkGaslessResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in claimLinkGasless Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
