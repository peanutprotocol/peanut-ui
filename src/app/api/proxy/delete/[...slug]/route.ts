import { fetchWithSentry } from '@/utils/sentry.utils'
import { NextRequest, NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'

export async function DELETE(request: NextRequest) {
    const separator = '/api/proxy/delete/'
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

    const apiResponse = await fetchWithSentry(fullAPIUrl, {
        method: 'DELETE',
        headers: headersToPass,
    })

    const apiResponseString = await apiResponse.text()

    return new NextResponse(apiResponseString, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
    })
}
