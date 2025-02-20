import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import * as consts from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function POST(request: NextRequest) {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    const apiKey = process.env.PEANUT_API_KEY
    const cookieStore = cookies()
    const token = cookieStore.get('jwt-token')

    if (!apiKey || !token) {
        return new NextResponse('Bad Request: missing required parameters', { status: 400 })
    }

    try {
        const apiFormData = new FormData()
        apiFormData.append('file', file)

        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/submit-profile-photo`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
            body: apiFormData,
        })

        if (response.status !== 200) {
            return new NextResponse('Error in get-user-id', {
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
        console.error('Error uploading profile photo:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
