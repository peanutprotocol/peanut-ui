import * as consts from '@/constants'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const password = formData.get('password') as string
        const senderAddress = formData.get('senderAddress') as string
        const attachmentOptions = JSON.parse(formData.get('attachmentOptions') as string)

        if (!password || !senderAddress) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Missing required fields: password and/or senderAddress',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const { address: pubKey } = generateKeysFromString(password)

        const requestBody = {
            pubKey,
            apiKey: process.env.PEANUT_API_KEY ?? '',
            senderAddress,
            reference: attachmentOptions.message,
            link: formData.get('link') as string,
            signature: null,
        }

        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/submit-claim-link/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': process.env.PEANUT_API_KEY ?? '',
            },
            body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            console.error('API Error:', errorData)
            return new NextResponse(
                JSON.stringify({
                    error: 'Failed to initialize claim link',
                    details: errorData?.message || response.statusText,
                    status: response.status,
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const data = await response.json()
        return new NextResponse(JSON.stringify({ fileUrl: data.linkEntry.file_url }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Failed to publish file (init):', error)
        return new NextResponse(
            JSON.stringify({
                error: 'Failed to process request',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
