// proxy.ts
// nextjs 16 renamed middleware.ts to proxy.ts
// https://nextjs.org/docs/messages/middleware-to-proxy
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import maintenanceConfig from '@/config/underMaintenance.config'
import { LOCALE_COOKIE, toAppLocale, toMarketingLocale } from '@/i18n/localeBridge'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import {
    SPLIT_CONTENT_LEGACY_PROXY_PATH_PREFIXES,
    SPLIT_EDGE_MARKER_HEADER,
    classifySplitContentRequest,
    hasTrustedSplitRawRouteStamp,
    hasUnsafeSplitRawRouteStamp,
    resolveSplitContentEdgeConfig,
    splitContentForwardHeaders,
} from '@/utils/split-content-edge'

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    const splitContentResponse = handleSplitContentEdge(request)
    if (splitContentResponse) return splitContentResponse

    // The final matcher exists only to bring encoded Split aliases to the
    // firewall. If it catches an unrelated encoded URL that no pre-seam matcher
    // owned, continue directly to the filesystem/app router so legacy promo and
    // maintenance behavior remains inert. Encoded URLs inside an original
    // proxy namespace still take the established path below.
    if (isSupplementalEncodedMatcherOnly(pathname)) return NextResponse.next()

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

    // NOTE: deliberately NO cookie-based /setup → /home bounce here. Cookie presence
    // says nothing about session validity; bouncing on it looped forever against the
    // logged-out `/home → /setup` redirect in (mobile-ui)/layout.tsx (TASK-21050,
    // logged-out PWA lockout). The authenticated-at-/setup case is handled client-side
    // by the existing-session prompt in (setup)/setup/page.tsx, which trusts /users/me.

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
    //
    // The exchange-rate route is exempt: it is intentionally cacheable and owns
    // its own narrower CDN policy, including no-store on its error paths.
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/exchange-rate') {
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        response.headers.set('Surrogate-Control', 'no-store')
    }

    return response
}

const SPLIT_BLOCKED_RESPONSE_HEADERS = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

function isSupplementalEncodedMatcherOnly(pathname: string): boolean {
    if (!/%[0-9a-f]{2}/i.test(pathname)) return false
    return !SPLIT_CONTENT_LEGACY_PROXY_PATH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
}

function handleSplitContentEdge(request: NextRequest): NextResponse | null {
    const edgeConfig = resolveSplitContentEdgeConfig(
        process.env.SPLIT_CONTENT_ORIGIN,
        process.env.SPLIT_CONTENT_EDGE_MARKER,
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT
    )

    // The platform sees structural hazards before WHATWG normalization and
    // stamps them with a caller-unforgeable bit. Check it before classifying
    // nextUrl.pathname, which may already be an unrelated route such as /home.
    if (hasUnsafeSplitRawRouteStamp(request.headers)) {
        if (edgeConfig.state === 'disabled') return null
        if (edgeConfig.state === 'invalid') {
            return new NextResponse(null, { status: 503, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
        }
        return new NextResponse(null, { status: 404, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    const route = classifySplitContentRequest(
        request.nextUrl.pathname,
        request.headers.get('rsc'),
        edgeConfig.state === 'ready' && edgeConfig.release ? edgeConfig.release.publicPaths : undefined
    )
    if (route.action === 'pass') return null

    // A completely unconfigured deployment keeps today's routing byte-for-byte.
    // Once any Split edge value is supplied, the boundary is live and fails closed.
    if (edgeConfig.state === 'disabled') return NextResponse.next()
    if (edgeConfig.state === 'invalid') {
        return new NextResponse(null, { status: 503, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    if (route.action === 'not-found') {
        return new NextResponse(null, { status: 404, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    // Origin credentials may be deployed before any public content. Without a
    // release document this boundary is active but dark (stage 0).
    if (!edgeConfig.release || edgeConfig.release.stage === 0) {
        return new NextResponse(null, { status: 404, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }
    if (route.kind === 'sitemap' && !edgeConfig.release.indexReleased) {
        return new NextResponse(null, { status: 404, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    // Vercel evaluates the raw incoming pathname before Next applies WHATWG
    // dot-segment normalization. A literal allowlisted route receives this
    // stamp; an alias such as /foo/%2e%2e/split-static/a.js does not, even
    // though Next later presents that alias here as /split-static/a.js.
    if (!hasTrustedSplitRawRouteStamp(request.headers)) {
        return new NextResponse(null, { status: 404, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new NextResponse(null, {
            status: 405,
            headers: { ...SPLIT_BLOCKED_RESPONSE_HEADERS, Allow: 'GET, HEAD' },
        })
    }

    // A self-rewrite or a renderer request returning through another project
    // alias can recurse through the edge. Only a fresh public ingress may be
    // rewritten into the renderer with the internal marker.
    if (edgeConfig.origin.origin === request.nextUrl.origin || request.headers.has(SPLIT_EDGE_MARKER_HEADER)) {
        return new NextResponse(null, { status: 503, headers: SPLIT_BLOCKED_RESPONSE_HEADERS })
    }

    const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, edgeConfig.origin)
    const headers = splitContentForwardHeaders(
        request.headers,
        request.nextUrl.host,
        edgeConfig.marker,
        edgeConfig.release
    )
    return NextResponse.rewrite(destination, { request: { headers } })
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
        '/split',
        '/split/:path*',
        '/((?!(?:[aA][pP][pPiI]|[dD][eE][vV]|[fF][aA][qQ]|[kK][yY][cC]|[lL][pP]|[pP][aA][yY](?:-[wW][iI][tT][hH])?|[qQ][rR]|[sS][dD][kK])/)[a-zA-Z]{2,3}(?:-[a-zA-Z]{4})?(?:-(?:[a-zA-Z]{2}|[0-9]{3}))?/[sS][pP][lL][iI][tT](?:/.*)?)',
        '/split-static',
        '/split-static/:path*',
        '/split-sitemap.xml',
        '/split-sitemap.xml/:path*',
        '/((?:[sS][pP][lL][iI][tT](?:-[sS][tT][aA][tT][iI][cC]|-[sS][iI][tT][eE][mM][aA][pP]\\.[xX][mM][lL])?)(?:/.*)?)',
        {
            source: '/:path*',
            has: [{ type: 'header', key: 'x-peanut-split-raw-unsafe', value: 'unsafe-v1' }],
        },
        '/((?=.*%[0-9A-Fa-f]{2}).*)',
    ],
}
