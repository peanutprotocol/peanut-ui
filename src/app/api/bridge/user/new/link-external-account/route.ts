import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as interfaces from '@/interfaces'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    try {
        const { userId, type } = await request.json()
        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }
        const response = await fetchWithSentry(`https://api.bridge.xyz/v0/kyc_links/${userId}`, {
            method: 'GET',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: interfaces.KYCData = await response.json()

        if (type === 'tos') {
            return new NextResponse(JSON.stringify({ tos_status: data.tos_status }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        } else if (type === 'kyc') {
            return new NextResponse(JSON.stringify({ kyc_status: data.kyc_status }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }
    } catch (error) {
        console.error('Failed to get KYC status:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
