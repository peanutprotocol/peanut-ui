import { NextRequest, NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL } from '@/constants'

/**
 * API route for automated link claiming without requiring user interaction.
 *
 * This route serves as a workaround for Next.js server action limitations:
 * Server actions cannot be directly called within useEffect hooks, which is
 * necessary for our automatic claim flow. By exposing this as an API route
 * instead, we can make the claim request safely from client-side effects.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { pubKey, recipient, password, campaignTag } = body

        if (!pubKey || !recipient || !password) {
            return NextResponse.json(
                { error: 'Missing required parameters: pubKey, recipient, or password' },
                { status: 400 }
            )
        }

        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links/${pubKey}/claim`, {
            method: 'POST',
            headers: {
                'api-key': process.env.PEANUT_API_KEY!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient,
                password,
                campaignTag,
            }),
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to claim link: ${response.statusText}` },
                { status: response.status }
            )
        }

        const responseText = await response.text()
        console.log('response', responseText)
        return new NextResponse(responseText, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error claiming send link:', error)
        return NextResponse.json({ error: 'Failed to claim send link' }, { status: 500 })
    }
}
