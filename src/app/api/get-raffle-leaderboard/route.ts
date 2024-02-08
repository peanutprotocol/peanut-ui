import type { NextRequest } from 'next/server'
import { getRaffleLeaderboard } from '@squirrel-labs/peanut-sdk'
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''

        console.log(body)

        const leaderboardInfo = await getRaffleLeaderboard({
            link: body.link,
            APIKey,
        })

        return new Response(JSON.stringify(leaderboardInfo), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in getRaffleLeaderboard Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//OK
