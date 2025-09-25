// middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const maintenanceMode = false

    if (maintenanceMode) {
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
    // Handle QR redirect lookups
    if (pathname.startsWith('/qr/')) {
        const match = pathname.match(/^\/qr\/([^\/?#]+)/)
        const code = match?.[1]

        console.log('[QR Redirect] Handling QR code:', code)

        if (code && PEANUT_API_URL) {
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 3000)

                const lookupUrl = `${PEANUT_API_URL}/redirect/lookup?input=${encodeURIComponent(`qr/${code}`)}`
                console.log('[QR Redirect] Looking up URL:', lookupUrl)

                const res = await fetch(lookupUrl, {
                    method: 'GET',
                    cache: 'no-store', // important to not cache this so the live update works fast (or should we?)
                    signal: controller.signal,
                })

                clearTimeout(timeoutId)
                console.log('[QR Redirect] Response status:', res.status)

                if (res.status === 200) {
                    const data = await res.json().catch(() => null)
                    const targetUrl = data?.targetUrl
                    if (typeof targetUrl === 'string' && targetUrl.length > 0) {
                        console.log('[QR Redirect] Redirecting to:', targetUrl)
                        return NextResponse.redirect(new URL(targetUrl, request.url))
                    }
                    console.log('[QR Redirect] Invalid target URL in response')
                }
                console.log('[QR Redirect] No redirect - falling through to normal routing')
                // If 404 or any other status, fall through to normal routing
            } catch (e) {
                console.error('[QR Redirect] Error during redirect lookup:', e)
                // Network error/timeout -> fall through to normal routing
            }
        } else {
            console.log('[QR Redirect] Missing code or API base URL')
        }
        // If code missing or base missing, fall through
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
        '/qr/:path*',
    ],
}
