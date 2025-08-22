import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

const API_KEY = process.env.PEANUT_API_KEY!

export async function PUT(request: NextRequest) {
    try {
        const { txHash, payerAddress } = await request.json()

        if (!txHash || !payerAddress) {
            return NextResponse.json({ error: 'Missing required fields: txHash and payerAddress' }, { status: 400 })
        }

        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/history/deposit`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'api-key': API_KEY,
            },
            body: JSON.stringify({
                txHash,
                payerAddress,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error(`Failed to update depositor address:`, errorData)
            return NextResponse.json(
                { error: 'Failed to update depositor address', details: errorData },
                { status: response.status }
            )
        }

        const responseJson = await response.json()
        return NextResponse.json(responseJson)
    } catch (error) {
        console.error(`Error updating depositor address:`, error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
