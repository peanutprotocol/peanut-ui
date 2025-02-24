import * as consts from '@/constants'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const { link, password, txHash, chainId, senderAddress, amountUsd, transaction } = await request.json()

        // validate required fields
        if (!link || !password || !txHash || !chainId || !senderAddress) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Missing required fields',
                    details: 'Required: link, password, txHash, chainId, senderAddress',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // generate pubKey from password
        const { address: pubKey } = generateKeysFromString(password)
        if (!pubKey) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Failed to generate pubKey',
                    details: 'Could not generate pubKey from password',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        // check if api key is available
        const apiKey = process.env.PEANUT_API_KEY
        if (!apiKey) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Server configuration error',
                    details: 'API key not configured',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const formattedTransaction = transaction
            ? {
                  from: transaction.from?.toString(),
                  to: transaction.to?.toString(),
                  data: transaction.data?.toString(),
                  value: transaction.value?.toString(),
              }
            : undefined

        const requestBody = {
            txHash,
            chainId,
            pubKey,
            link,
            apiKey,
            amountUsd: amountUsd || 0,
            userAddress: senderAddress,
            signature: '',
            transaction: formattedTransaction,
        }

        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/submit-claim-link/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            console.error('Backend API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                requestBody: {
                    ...requestBody,
                    apiKey: '[REDACTED]',
                },
            })
            return new NextResponse(
                JSON.stringify({
                    error: 'Failed to complete claim link submission',
                    details: errorData?.error || errorData?.message || response.statusText,
                    status: response.status,
                    requestData: {
                        pubKey,
                        txHash,
                        chainId,
                        link: link.substring(0, 20) + '...', // only log part of the link
                    },
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const data = await response.json()

        if (data.status !== 'completed') {
            console.error('Incomplete status from backend:', data)
            return new NextResponse(
                JSON.stringify({
                    error: 'Claim link submission incomplete',
                    details: `Status: ${data.status}`,
                    status: 400,
                    response: data,
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        return new NextResponse(JSON.stringify({ status: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Failed to complete claim link submission:', error)
        return new NextResponse(
            JSON.stringify({
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : 'Unknown error',
                additionalInfo: 'An unexpected error occurred while processing the claim link submission',
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
