import type { NextRequest } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL ?? ''

        if (!webhookUrl) throw new Error('DISCORD_WEBHOOK not found in env')

        const response = await fetchWithSentry(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: body.message,
            }),
        })

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in discord send notif Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

// OK
