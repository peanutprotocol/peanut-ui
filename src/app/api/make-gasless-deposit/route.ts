import type { NextRequest } from 'next/server'
import { makeDepositGasless, toggleVerbose } from '@squirrel-labs/peanut-sdk'
import { ethers } from 'ethers'
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const APIKey = process.env.PEANUT_API_KEY ?? ''

        const payload = {
            ...body.payload,
            uintAmount: ethers.BigNumber.from(body.payload.uintAmount).toString(),
            validAfter: ethers.BigNumber.from(body.payload.validAfter).toString(),
            validBefore: ethers.BigNumber.from(body.payload.validBefore).toString(),
        }

        toggleVerbose(true)
        const makeDepositGaslessResponse = await makeDepositGasless({
            APIKey: APIKey,
            payload: payload,
            signature: body.signature,
            baseUrl: body.baseUrl,
        })

        return new Response(JSON.stringify(makeDepositGaslessResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error in makeDepositGasless Route Handler:', error)
        return new Response('Internal Server Error', { status: 500 })
    }
}

//NOT OK
