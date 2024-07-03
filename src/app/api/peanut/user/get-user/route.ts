import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const accountIdentifier = searchParams.get('accountIdentifier')
        const apiKey = process.env.PEANUT_API_KEY

        if (!accountIdentifier || !apiKey) {
            return new NextResponse('Bad Request: accountIdentifier and apiKey are required', { status: 400 })
        }

        const uniqueParam = `t=${new Date().getTime()}`
        const response = await fetch(
            `http://localhost:5001/user/fetch?accountIdentifier=${accountIdentifier}&apiKey=${apiKey}&${uniqueParam}`,
            {
                method: 'GET',
            }
        )

        if (response.status === 404) {
            return new NextResponse('Not Found', {
                status: 404,
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
