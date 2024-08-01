import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

    console.log({
        apiKey,
        token,
        file,
    })
    try {
        const apiFormData = new FormData()
        apiFormData.append('file', file)

        console.log(apiFormData)

        const response = await fetch('http://localhost:5001/submit-profile-photo', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.value}`,
                'api-key': apiKey,
            },
            body: apiFormData,
        })

        if (!response.ok) {
            return new NextResponse('Failed to upload profile photo', { status: response.status })
        }

        const data = await response.json()
        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.log(error)
        console.error('Error uploading profile photo:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
