import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

export const maxDuration = 300 // vercel timeout

/**
 * Proxy requests from the UI to the API.
 * To every request:
 * 1. Add `x-forwarded-for` header with the caller ip address.
 * 2. Add apiKey (the api key that's needed to use our API).
 */
export async function POST(request: NextRequest) {
    const separator = '/api/proxy/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    let jsonToPass
    try {
        jsonToPass = await request.json()
    } catch (error: any) {
        console.error('Error while parsing json:', error)
        return NextResponse.json('Pass a valid json', {
            status: 400,
        })
    }

    jsonToPass.apiKey = process.env.PEANUT_API_KEY!

    const userIp = request.headers.get('x-forwarded-for') || request.ip
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
        'Accept-Encoding': 'gzip', // Explicitly accept gzip encoding
        'Api-Key': process.env.PEANUT_API_KEY!,
        Origin: request.headers.get('origin'),
    } as any
    if (request.headers.get('x-username')) {
        headersToPass['x-username'] = request.headers.get('x-username')
    }

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'POST',
        headers: headersToPass,
        body: JSON.stringify(jsonToPass),
    })

    // render returns in gzip format - turn to string and let next handle it
    const apiResponseString = await apiResponse.text()

    const response = new NextResponse(apiResponseString, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
    const cookies = apiResponse.headers.getSetCookie()
    for (const cookie of cookies) {
        response.headers.append('Set-Cookie', cookie)
    }
    return response
}
