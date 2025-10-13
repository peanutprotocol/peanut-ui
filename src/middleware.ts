// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import maintenanceConfig from '@/config/underMaintenance.config'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Block /dev routes in production
    if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev')) {
        return NextResponse.redirect(new URL('/404', request.url))
    }

    // check if full maintenance mode is enabled
    if (maintenanceConfig.enableFullMaintenance) {
        const allowedPaths = ['/', '/maintenance', '/apple-app-site-association', '/support']
        if (
            !allowedPaths.includes(pathname) &&
            !pathname.startsWith('/api/') &&
            !pathname.startsWith('/_next/') &&
            !pathname.startsWith('/.well-known/') &&
            !pathname.match(
                /.*\.(jpg|jpeg|png|gif|svg|ico|ttf|woff|woff2|eot|css|js|json|xml|txt|mp3|mp4|webm|ogg|wav|flac|aac)$/
            )
        ) {
            return NextResponse.redirect(new URL('/maintenance', request.url))
        }
    }

    const url = request.nextUrl.clone()
    const promoList: { [key: string]: string } = JSON.parse(process.env.PROMO_LIST ?? '{}')

    // get jwt token from cookies
    const isAuthenticated = request.cookies.get('jwt-token')

    // if user is authenticated, redirect to home page
    if (isAuthenticated && request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/home', request.url))
    }

    if (isAuthenticated && request.nextUrl.pathname === '/setup') {
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
    matcher: [
        '/',
        '/home',
        '/claim/:path*',
        '/api/:path*',
        '/home/:path*',
        '/profile/:path*',
        '/send/:path*',
        '/request/:path*',
        '/settings/:path*',
        '/setup/:path*',
        '/share/:path*',
        '/history/:path*',
        '/raffle/:path*',
        '/c/:path*',
        '/pay/:path*',
        '/p/:path*',
        '/link/:path*',
        '/dev/:path*',
    ],
}
