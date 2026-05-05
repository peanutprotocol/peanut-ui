import { NextRequest, NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

async function handleFormDataRequest(request: NextRequest, method: string) {
    const separator = '/api/proxy/withFormData/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    const formData = await request.formData() // Get the form data from the request

    const apiFormData = new FormData()
    formData.forEach((value, key) => {
        apiFormData.append(key, value)
    })

    const apiKey = process.env.PEANUT_API_KEY
    if (!apiKey) {
        console.error('PEANUT_API_KEY environment variable is not set')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const headers: Record<string, string> = {
        // Don't set Content-Type header, let it be automatically set as multipart/form-data
        'api-key': apiKey,
    }
    // Forward Authorization so backend routes can read the user's JWT.
    // Parity with /api/proxy/[...slug] (POST). Without this, the backend's
    // soft-auth path on /charges sees no user — withdraws to external
    // addresses then FK-violate on transaction_intents_user_id_fkey when
    // the recipient isn't a known Peanut account.
    const authHeader = request.headers.get('authorization')
    if (authHeader) headers['authorization'] = authHeader

    const response = await fetchWithSentry(fullAPIUrl, {
        method,
        headers,
        body: apiFormData,
    })

    const apiResponse = await response.text()

    return new NextResponse(apiResponse, {
        status: response.status,
        statusText: response.statusText,
    })
}

export async function POST(request: NextRequest) {
    return handleFormDataRequest(request, 'POST')
}

export async function PATCH(request: NextRequest) {
    return handleFormDataRequest(request, 'PATCH')
}
