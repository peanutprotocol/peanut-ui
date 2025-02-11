// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone()
    const promoList: { [key: string]: string } = JSON.parse(process.env.PROMO_LIST ?? '{}')

    // get jwt token from cookies
    const isAuthenticated = request.cookies.get('jwt-token')

    // if user is authenticated, redirect to home page
    if (isAuthenticated && request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/home', request.url))
    }

    // Handle promo link redirection
    if (isPromoLink(url)) {
        const fragment = url.searchParams.toString()
        const redirectUrl = `https://peanut.to/claim?&${promoList[fragment]}`
        return NextResponse.redirect(redirectUrl)
    }

    // Set headers to disable caching for specified paths
    const response = NextResponse.next()
    if (url.pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        response.headers.set('Surrogate-Control', 'no-store')
    }

    return response
}

const isPromoLink = (url: URL) => {
    const linkChainId = url.searchParams.get('promo')
    const linkVersion = url.searchParams.get('id')

    return !!(linkChainId && linkVersion)
}

// Updated matcher to include root path
export const config = {
    matcher: ['/', '/claim/:path*', '/api/:path*'],
}
