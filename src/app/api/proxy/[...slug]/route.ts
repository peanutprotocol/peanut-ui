import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '../../api.consts'

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
    const fullAPIUrl = `${PEANUT_API_URL}${endpointToCall}`

    let jsonToPass
    try {
        jsonToPass = await request.json()
    } catch (error: any) {
        return NextResponse.json('Pass a valid json', {
            status: 403,
        })
    }
    jsonToPass.apiKey = process.env.PEANUT_API_KEY!

    const userIp = request.headers.get('cf-connecting-ip') || request.ip
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
    } as any

    const apiResponse = await fetch(fullAPIUrl, {
        method: 'POST',
        headers: headersToPass,
        body: JSON.stringify(jsonToPass),
    })

    return new NextResponse(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: apiResponse.headers,
    })
}
