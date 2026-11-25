// proxy.ts
// nextjs 16 renamed middleware.ts to proxy.ts
// https://nextjs.org/docs/messages/middleware-to-proxy
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { shouldBlockDevRoute } from '@/constants/dev-tools.consts'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'
import { APP_ENTRY_QUERY_PARAM } from '@/constants/migration.consts'
import { marketingQrHandoffUrl } from '@/features/marketing-qr/contract'
import { legacyCreatorInvitePath } from '@/features/tracked-links/contract'
import { COUNTRY_HEADER, landingLocale } from '@/i18n/landingLocale'
import { LOCALE_COOKIE, toAppLocale } from '@/i18n/localeBridge'
import { DEFAULT_LOCALE } from '@/i18n/types'

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Internal dev tooling must not answer on peanut.me. The client gate in
    // (mobile-ui)/dev/layout.tsx renders the not-found UI but still returns 200,
    // so the real 404 has to come from here. This also covers the pages under
    // `src/app/dev/*`, which have no layout gate at all.
    if (shouldBlockDevRoute(pathname)) {
        return new NextResponse(null, { status: 404 })
    }

    // Retired marketing pages answer 410 before the page route runs, so the
    // status holds even while the content mirror still has their files.
    if (isGoneMarketingPath(pathname)) {
        return new NextResponse(null, { status: 410, headers: { 'X-Robots-Tag': 'noindex' } })
    }

    // Registered landing-page QRs also enter through /home, so an installed app opens
    // directly. A browser records the opening on /q first; /q continues to /app.
    const marketingQrHandoff = marketingQrHandoffUrl(new URL(request.url))
    if (marketingQrHandoff) return NextResponse.redirect(marketingQrHandoff, 307)

    // Retired creator links had their own store screen on /app. A browser now gets the
    // creator's invite page; the installed app never asks the server and reads them itself.
    const isAppEntry = pathname === '/home' && request.nextUrl.searchParams.get(APP_ENTRY_QUERY_PARAM) === '1'
    if (isAppEntry || pathname === '/app' || pathname === '/app/') {
        const invitePath = legacyCreatorInvitePath(request.nextUrl.searchParams)
        if (invitePath) return NextResponse.redirect(new URL(invitePath, request.url), 307)
    }

    // QR downloads enter through /home because that path is already claimed by
    // every released native shell. A browser has no App Link interception, so
    // route it to the web-only smart-store page while preserving the deferred
    // handoff. Remove the routing marker so /app can never loop back here.
    if (isAppEntry) {
        const target = request.nextUrl.clone()
        target.pathname = '/app'
        target.searchParams.delete(APP_ENTRY_QUERY_PARAM)
        return NextResponse.redirect(target, 307)
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
    // logged-out redirect loop). The authenticated-at-/setup case is handled client-side
    // by the existing-session prompt in (setup)/setup/page.tsx, which trusts /users/me.

    // Handle promo link redirection. Must run before the locale redirect: the
    // localized landing routes aren't in the matcher, so a promo link that gets
    // locale-redirected first would never come back through this branch.
    if (isPromoLink(url)) {
        const fragment = url.searchParams.toString()
        const redirectUrl = `https://peanut.me/claim?&${promoList[fragment]}`
        return NextResponse.redirect(redirectUrl)
    }

    // Send a visitor to the landing page in their language: the shared landing-page rule
    // (landingLocale: cookie, then Accept-Language with the country as a Spanish tiebreaker;
    // crawlers stay on the English `/`, and hreflang keeps routing them). Placed after the auth
    // check so signed-in users still go to /home.
    if (request.nextUrl.pathname === '/') {
        const stored = request.cookies.get(LOCALE_COOKIE)?.value
        const locale = landingLocale({
            storedLocale: stored,
            acceptLanguage: request.headers.get('accept-language'),
            country: request.headers.get(COUNTRY_HEADER),
            userAgent: request.headers.get('user-agent'),
        })
        if (locale !== DEFAULT_LOCALE) {
            // 307, not 308: `/` stays the canonical English URL.
            const target = new URL(`/${locale}`, request.url)
            // Keep the query string: campaign/UTM params must survive the hop.
            target.search = request.nextUrl.search
            const localized = NextResponse.redirect(target, 307)
            localized.headers.set('Vary', `Cookie, Accept-Language, ${COUNTRY_HEADER}`)
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
        '/app',
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
        // Retired marketing pages (GONE_MARKETING_PATHS in gone-routes.consts.ts).
        '/:locale/united-kingdom',
        '/:locale/send-money-from/united-kingdom/to/:to',
    ],
}
