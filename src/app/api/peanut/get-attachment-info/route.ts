import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getRawParamsFromLink, generateKeysFromString } from '@squirrel-labs/peanut-sdk' // Adjust the import paths according to your project structure

export async function POST(request: NextRequest) {
    try {
        const { link } = await request.json()
        const params = getRawParamsFromLink(link)
        const { address: pubKey } = generateKeysFromString(params.password)

        const response = await fetch('https://api.staging.peanut.to/get-link-details', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pubKey,
                apiKey: process.env.PEANUT_API_KEY,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        return new NextResponse(
            JSON.stringify({
                fileUrl: data.linkInfo.file_url,
                message: data.linkInfo.text_content,
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )
    } catch (error) {
        console.error('Failed to get attachment:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
