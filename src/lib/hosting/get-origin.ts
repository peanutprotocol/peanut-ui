import { headers } from 'next/headers'

export default async function getOrigin(): Promise<string> {
    const h = await headers()
    const host = h.get('host')

    // validate host header to prevent injection
    if (!host || !/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) {
        throw new Error('Invalid host header')
    }

    const forwardedProto = h.get('x-forwarded-proto')
    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http')


    return `${protocol}://${host}`
}
