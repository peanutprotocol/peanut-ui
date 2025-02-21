import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as consts from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { bridgeCustomerId, email, fullName, physicalAddress = undefined, userDetails = undefined } = body

        const apiKey = process.env.PEANUT_API_KEY

        if (!apiKey || !bridgeCustomerId || !email || !fullName) {
            return new NextResponse('Bad Request: Missing required fields', { status: 400 })
        }

        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/user/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                bridgeCustomerId,
                email,
                fullName,
                physicalAddress,
                userDetails,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create user: ${response.status}`)
        }

        const data = await response.json()

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
