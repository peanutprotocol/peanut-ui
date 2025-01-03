// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ALLOWED_IFRAME_DOMAINS } from './constants'

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone()
    const promoList: { [key: string]: string } = JSON.parse(process.env.PROMO_LIST ?? '{}')

    // Handle promo link redirection
    if (isPromoLink(url)) {
        const fragment = url.searchParams.toString()
        const redirectUrl = `https://peanut.to/claim?&${promoList[fragment]}`
        return NextResponse.redirect(redirectUrl)
    }

    // Create response with security headers
    const response = NextResponse.next()

    // Add frame ancestor security headers
    const frameAncestors =
        ALLOWED_IFRAME_DOMAINS.length > 0
            ? `frame-ancestors 'self' ${ALLOWED_IFRAME_DOMAINS.join(' ')}`
            : "frame-ancestors 'self'"

    response.headers.set('Content-Security-Policy', frameAncestors)

    // Handle X-Frame-Options based on referer
    const referer = request.headers.get('referer')
    if (referer) {
        const refererUrl = new URL(referer)
        if (ALLOWED_IFRAME_DOMAINS.includes(refererUrl.origin)) {
            response.headers.set('X-Frame-Options', 'ALLOW-FROM ' + refererUrl.origin)
        } else {
            response.headers.set('X-Frame-Options', 'SAMEORIGIN')
        }
    } else {
        response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    }

    // Set headers to disable caching for specified paths
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

// Specify the paths that should use this middleware + Updated matcher to include all routes that need security headers
export const config = {
    matcher: ['/claim/:path*', '/api/:path*', '/((?!_next|static|favicon.ico|robots.txt).*)'],
}
