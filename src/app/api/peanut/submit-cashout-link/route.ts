import * as consts from '@/constants'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

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
            promoCode,
            trackParam,
        } = await request.json()

        // validate required fields
        const requiredFields = {
            bridgeCustomerId,
            liquidationAddressId,
            cashoutTransactionHash,
            externalAccountId,
            chainId,
            tokenName,
            pubKey,
        }

        const missingFields = Object.entries(requiredFields)
            .filter(([, value]) => !value)
            .map(([key]) => key)

        if (missingFields.length > 0) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Missing required fields',
                    details: `Required fields missing: ${missingFields.join(', ')}`,
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const apiKey = process.env.PEANUT_API_KEY!
        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/cashouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                bridgeCustomerId,
                liquidationAddressId,
                cashoutTransactionHash,
                externalAccountId,
                chainId,
                tokenName,
                pubKey,
                promoCode,
                trackParam,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            console.error('Cashout API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
            })
            return new NextResponse(
                JSON.stringify({
                    error: 'Failed to submit cashout',
                    details: errorData?.error || errorData?.message || response.statusText,
                    status: response.status,
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Failed to submit cashout link:', error)
        return new NextResponse(
            JSON.stringify({
                error: 'Failed to process cashout request',
                details: error instanceof Error ? error.message : 'Unknown error',
                additionalInfo: 'An unexpected error occurred while processing the cashout request',
                debug: {
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    stack: error instanceof Error ? error.stack : undefined,
                },
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
