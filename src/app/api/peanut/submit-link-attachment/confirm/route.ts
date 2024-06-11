import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'

export async function POST(request: NextRequest) {
    try {
        const { link, password, txHash, chainId } = await request.json()
        const { address: pubKey } = generateKeysFromString(password)

        const response = await fetch('https://api.staging.peanut.to/submit-claim-link/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pubKey: pubKey,
                apiKey: process.env.PEANUT_API_KEY,
                txHash: txHash,
                chainId: chainId,
                link: link,
                signature: '',
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()

        if (data.status !== 'completed') {
            throw new Error(`HTTP error! status: ${data.status}`)
        }

        return new NextResponse(null, { status: 200 })
    } catch (error) {
        console.error('Failed to publish file (complete):', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
