import { fetchWithSentry } from '@/utils/sentry.utils'
import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'

export const maxDuration = 300 // vercel timeout

/**
 * Clean POST proxy that only adds headers (no body modification).
 * Use this for endpoints with strict schema validation.
 */
export async function POST(request: NextRequest) {
    const separator = '/api/proxy/post/'
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

    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
        'Accept-Encoding': 'gzip',
        'api-key': process.env.PEANUT_API_KEY!,
        Origin: request.headers.get('origin'),
    } as any

    const authHeader = request.headers.get('authorization')
    if (authHeader) {
        headersToPass['authorization'] = authHeader
    }

    if (request.headers.get('x-username')) {
        headersToPass['x-username'] = request.headers.get('x-username')
    }

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'POST',
        headers: headersToPass,
        body: JSON.stringify(jsonToPass),
    })

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
