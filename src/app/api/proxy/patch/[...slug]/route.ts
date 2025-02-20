import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

export async function PATCH(request: NextRequest) {
    const separator = '/api/proxy/patch/'
    const indexOfSeparator = request.url.indexOf(separator)
    const endpointToCall = request.url.substring(indexOfSeparator + separator.length)
    const fullAPIUrl = `${PEANUT_API_URL}/${endpointToCall}`

    let jsonToPass
    try {
        jsonToPass = await request.json()
    } catch (error: any) {
        console.error('Error while parsing json:', error)
        return NextResponse.json('Pass a valid json', {
            status: 403,
        })
    }

    jsonToPass.apiKey = process.env.PEANUT_API_KEY!

    const userIp = request.headers.get('x-forwarded-for') || request.ip
    const headersToPass = {
        'Content-Type': 'application/json',
        'x-forwarded-for': userIp,
        'Accept-Encoding': 'gzip', // Explicitly accept gzip encoding
        'Api-Key': process.env.PEANUT_API_KEY!,
    } as any

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'PATCH',
        headers: headersToPass,
        body: JSON.stringify(jsonToPass),
    })

    // render returns in gzip format - turn to string and let next handle it
    const apiResponseString = await apiResponse.text()

    return new NextResponse(apiResponseString, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
}
