import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'

export async function GET(_request: NextRequest) {
    const cookieStore = cookies()
    const token = cookieStore.get('jwt-token')
    const apiKey = process.env.PEANUT_API_KEY

    if (!token || !apiKey) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }
    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/get-user`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
        })

        if (response.status !== 200) {
            return new NextResponse('Error in get-from-cookie', {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
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
