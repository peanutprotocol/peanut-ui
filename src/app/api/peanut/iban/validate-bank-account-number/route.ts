import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const { bankAccountNumber } = await request.json()
        const apiKey = process.env.PEANUT_API_KEY

        if (!bankAccountNumber || !apiKey) {
            return new NextResponse('Bad Request: missing required parameters', { status: 400 })
        }

        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/validate-bank-account-number`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                bankAccountNumber,
            }),
        })

        const data = await response.json()
        if (response.status !== 200) {
            return new NextResponse(JSON.stringify(data), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
