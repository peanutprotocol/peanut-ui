import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import { url } from 'inspector'

export async function POST(request: NextRequest) {
    try {
        const {
            pubKey,
            bridgeCustomerId,
            liquidationAddressId,
            cashoutTransactionHash, // has to be destination chain transaction hash!
            externalAccountId,
            chainId,
            tokenName,
        } = await request.json()

        const apiKey = process.env.PEANUT_API_KEY!
        const response = await fetch(`${consts.PEANUT_API_URL}/cashouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                bridgeCustomerId: bridgeCustomerId,
                liquidationAddressId: liquidationAddressId,
                cashoutTransactionHash: cashoutTransactionHash,
                externalAccountId: externalAccountId,
                chainId: chainId,
                tokenName: tokenName,
                pubKey: pubKey,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to submit cashout link:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
