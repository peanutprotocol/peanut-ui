// proxy.ts
// nextjs 16 renamed middleware.ts to proxy.ts
// https://nextjs.org/docs/messages/middleware-to-proxy
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import maintenanceConfig from '@/config/underMaintenance.config'
import { LOCALE_COOKIE, toAppLocale, toMarketingLocale } from '@/i18n/localeBridge'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // /dev/ routes are now accessible in production for testing
    // Uncomment below to block /dev/ routes in production if needed
    // if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev/')) {
    //     return new NextResponse(null, { status: 404 })
    // }

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

    // Handle promo link redirection. Must run before the locale redirect: the
    // localized landing routes aren't in the matcher, so a promo link that gets
    // locale-redirected first would never come back through this branch.
    if (isPromoLink(url)) {
        const fragment = url.searchParams.toString()
        const redirectUrl = `https://peanut.me/claim?&${promoList[fragment]}`
        return NextResponse.redirect(redirectUrl)
    }

    // Send a visitor to the landing page in their language. The cookie (an
    // explicit choice) wins; a first-time visitor falls back to
    // Accept-Language, with crawlers exempt: Google's localized-versions
    // guidance warns against language-sniffing redirects because crawlers
    // arrive from US IPs sending `en` and would never reach the localized
    // pages — so bots always get the English `/` and hreflang keeps routing
    // them. Placed after the auth check so signed-in users still go to /home.
    if (request.nextUrl.pathname === '/') {
        const stored = request.cookies.get(LOCALE_COOKIE)?.value
        const fromCookie = stored ? toMarketingLocale(stored) : null
        const locale =
            fromCookie ??
            (isCrawler(request) ? DEFAULT_LOCALE : preferredLocale(request.headers.get('accept-language')))
        if (locale !== DEFAULT_LOCALE) {
            // 307, not 308: `/` stays the canonical English URL.
            const target = new URL(`/${locale}`, request.url)
            // Keep the query string: campaign/UTM params must survive the hop.
            target.search = request.nextUrl.search
            const localized = NextResponse.redirect(target, 307)
            localized.headers.set('Vary', 'Cookie, Accept-Language')
            // Pre-set the shared cookie so the app and later visits agree with
            // the browser language without re-sniffing. Only when no explicit
            // choice exists yet — the switcher's cookie is never overwritten.
            if (!stored) {
                localized.cookies.set(LOCALE_COOKIE, toAppLocale(locale), { path: '/', maxAge: 60 * 60 * 24 * 365 })
            }
            return localized
        }
    }

    // Set headers to disable caching for specified paths
    const response = NextResponse.next()
    // No `Vary: Cookie` on this path: Next overwrites Vary with its own RSC list
    // after the proxy runs, and neither next.config headers() nor vercel.json
    // headers survive it (both were tried and verified ineffective on a preview
    // deploy). It isn't load-bearing — the proxy runs ahead of the cache on
    // every request to `/`, so a cached English `/` still gets redirected for a
    // visitor whose cookie says otherwise. The redirect response above does
    // carry Vary, since nothing rewrites it.
    if (url.pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        response.headers.set('Surrogate-Control', 'no-store')
    }

    return response
}

const CRAWLER_UA =
    /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|linkedinbot|embedly|quora link preview|pinterest|vkshare|redditbot|applebot|semrush|ahrefs|screaming frog/i

function isCrawler(request: NextRequest): boolean {
    const ua = request.headers.get('user-agent')
    // No UA at all is not a browser either — treat as a bot, never redirect.
    return !ua || CRAWLER_UA.test(ua)
}

/**
 * Highest-quality Accept-Language range that maps onto a supported locale.
 * An explicit English range wins at its own position, so `en;q=1, es;q=0.5`
 * stays English rather than being dragged to the first non-default match.
 */
function preferredLocale(header: string | null): Locale {
    if (!header) return DEFAULT_LOCALE
    const ranges = header
        .split(',')
        .map((part) => {
            const [tag, ...params] = part.trim().split(';')
            const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
            return { tag: tag.trim().toLowerCase(), quality: q ? Number.parseFloat(q.slice(2)) : 1 }
        })
        .filter((range) => range.tag && Number.isFinite(range.quality) && range.quality > 0)
        .sort((a, b) => b.quality - a.quality)
    for (const { tag } of ranges) {
        if (tag === 'en' || tag.startsWith('en-') || tag === '*') return DEFAULT_LOCALE
        const locale = toMarketingLocale(tag)
        if (locale !== DEFAULT_LOCALE) return locale
    }
    return DEFAULT_LOCALE
}

const isPromoLink = (url: URL) => {
    const linkChainId = url.searchParams.get('promo')
    const linkVersion = url.searchParams.get('id')

    return !!(linkChainId && linkVersion)
}

// Middleware matcher configuration
// NOTE: This must be a static array for Next.js to parse at build time
// Routes are documented in src/constants/routes.ts (MIDDLEWARE_ROUTES)
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
        '/qr/:path*',
    ],
}
