import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'

export async function POST(request: NextRequest) {
    const separator = '/api/proxy/withFormData/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    const formData = await request.formData() // Get the form data from the request

    const apiFormData = new FormData()
    formData.forEach((value, key) => {
        apiFormData.append(key, value)
    })

    const response = await fetch(fullAPIUrl, {
        method: 'POST',
        headers: {
            // Don't set Content-Type header, let it be automatically set as multipart/form-data
            'api-key': process.env.PEANUT_API_KEY!,
        },
        body: apiFormData,
    })

    const apiResponse = await response.text()

    return new NextResponse(apiResponse, {
        status: response.status,
        statusText: response.statusText,
    })
}
