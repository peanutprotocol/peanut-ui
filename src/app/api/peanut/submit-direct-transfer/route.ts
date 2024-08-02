import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { txHash, chainId, senderAddress, amountUsd, transaction } = await request.json()

        const response = await fetch('https://api.staging.peanut.to/submit-direct-transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: process.env.PEANUT_API_KEY,
                txHash: txHash,
                chainId: chainId,
                userAddress: senderAddress,
                amountUsd: amountUsd,
                transaction: transaction,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (!data) {
            throw new Error(`HTTP error! status: data undefined`)
        }

        return new NextResponse(null, { status: 200 })
    } catch (error) {
        console.error('Failed to push points:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
