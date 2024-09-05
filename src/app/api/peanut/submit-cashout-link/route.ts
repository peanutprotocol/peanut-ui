import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import { url } from 'inspector'

export async function POST(request: NextRequest) {
    try {
        const {
            link,
            bridgeCustomerId,
            liquidationAddressId,
            cashoutTransactionHash,
            externalAccountId,
            chainName,
            tokenName,
        } = await request.json()

        const fragment = link.split('#')[1]
        const password = new URLSearchParams(fragment).get('p')!
        const { address: pubKey } = generateKeysFromString(password)

        const response = await fetch(`${consts.PEANUT_API_URL}/submit-cashout-link`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                link: link,
                bridgeCustomerId: bridgeCustomerId,
                liquidationAddressId: liquidationAddressId,
                cashoutTransactionHash: cashoutTransactionHash,
                externalAccountId: externalAccountId,
                chainName: chainName,
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
