import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk' // Adjust the import paths according to your project structure

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const password = formData.get('password') as string
        const attachmentOptions = JSON.parse(formData.get('attachmentOptions') as string)

        const { address: pubKey } = generateKeysFromString(password)

        const apiFormData = new FormData()
        apiFormData.append('pubKey', pubKey)
        apiFormData.append('apiKey', process.env.PEANUT_API_KEY ?? '')
        if (attachmentOptions.message) {
            apiFormData.append('reference', attachmentOptions.message)
        }
        if (attachmentOptions.attachmentFile) {
            apiFormData.append('file', formData.get('attachmentFile') as File)
        }

        const response = await fetch('https://api.staging.peanut.to/submit-claim-link/init', {
            method: 'POST',
            body: apiFormData,
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()

        return new NextResponse(JSON.stringify({ fileUrl: data.linkEntry.file_url }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to publish file (init):', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
