import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { proxyUpstream, upstreamErrorResponse } from '../../_lib/upstream'

export const maxDuration = 300 // vercel timeout

export async function GET(request: NextRequest) {
    const separator = '/api/proxy/get/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
        'Accept-Encoding': 'gzip', // Explicitly accept gzip encoding
        'Api-Key': process.env.PEANUT_API_KEY!,
    } as any

    const authHeader = request.headers.get('authorization')
    if (authHeader) {
        headersToPass['authorization'] = authHeader
    }

    let apiResponse: Response
    try {
        apiResponse = await proxyUpstream(fullAPIUrl, {
            method: 'GET',
            headers: headersToPass,
        })
    } catch (error) {
        return upstreamErrorResponse(error, fullAPIUrl)
    }

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

    const userIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const headersToPass = {
        'x-forwarded-for': userIp,
        'Api-Key': process.env.PEANUT_API_KEY!,
    } as any

    const authHeader = request.headers.get('authorization')
    if (authHeader) {
        headersToPass['authorization'] = authHeader
    }

    let apiResponse: Response
    try {
        apiResponse = await proxyUpstream(fullAPIUrl, {
            method: 'HEAD',
            headers: headersToPass,
        })
    } catch (error) {
        return upstreamErrorResponse(error, fullAPIUrl)
    }

    return new NextResponse(null, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
}
