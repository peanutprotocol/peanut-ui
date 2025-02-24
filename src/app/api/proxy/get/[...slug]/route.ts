import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function GET(request: NextRequest) {
    const separator = '/api/proxy/get/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    const userIp = request.headers.get('x-forwarded-for') || request.ip
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
        'Accept-Encoding': 'gzip', // Explicitly accept gzip encoding
        'Api-Key': process.env.PEANUT_API_KEY!,
    } as any

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'GET',
        headers: headersToPass,
    })

    // render returns in gzip format - turn to string and let next handle it
    const apiResponseString = await apiResponse.text()

    return new NextResponse(apiResponseString, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
}

export async function HEAD(request: NextRequest) {
    const separator = '/api/proxy/get/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    const userIp = request.headers.get('x-forwarded-for') || request.ip
    const headersToPass = {
        'x-forwarded-for': userIp,
        'Api-Key': process.env.PEANUT_API_KEY!,
    } as any

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'HEAD',
        headers: headersToPass,
    })

    return new NextResponse(null, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
}
