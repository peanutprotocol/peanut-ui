import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone()
    const promoList: { [key: string]: string } = JSON.parse(process.env.PROMO_LIST ?? '{}')

    if (isPromoLink(url)) {
        const fragment = url.searchParams.toString()
        const redirectUrl = `https://experimental.peanut.to/claim?&${promoList[fragment]}`
        return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.next()
}

const isPromoLink = (url: URL) => {
    const linkChainId = url.searchParams.get('promo')
    const linkVersion = url.searchParams.get('id')

    return !!(linkChainId && linkVersion)
}

export const config = {
    matcher: '/claim/:path*',
}
