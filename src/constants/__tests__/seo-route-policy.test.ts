/** @jest-environment node */

import {
    GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS,
    NOINDEX_EXACT_ROUTES,
    NOINDEX_HEADER,
    NOINDEX_ROUTE_PREFIXES,
    ROBOTS_DISALLOWED_PATHS,
    buildNoindexHeaderRules,
} from '../seo-route-policy'
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

const criticalAppRoutes = [
    '/app',
    '/home',
    '/profile',
    '/send',
    '/setup',
    '/invite',
    '/card',
    '/badges',
    '/limits',
    '/notifications',
    '/recover-funds',
    '/card-recovery',
    '/fix-card-signature',
]

const crawlablePublicRoutes = ['/lp', '/api/og/marketing', '/m/stain', '/m/badigitalnomads']

function receivesNoindexHeader(path: string): boolean {
    return (
        NOINDEX_EXACT_ROUTES.includes(path) ||
        NOINDEX_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    )
}

async function renderedRobotsHeader(path: string): Promise<string | null> {
    const response = await unstable_getResponseFromNextConfig({
        url: `https://peanut.me${path}`,
        nextConfig: { headers: async () => buildNoindexHeaderRules() },
    })

    return response.headers.get('x-robots-tag')
}

describe('SEO route policy', () => {
    it('emits noindex response headers for every non-marketing route prefix', () => {
        expect(buildNoindexHeaderRules()).toEqual([
            ...NOINDEX_EXACT_ROUTES.map((source) => ({ source, headers: [NOINDEX_HEADER] })),
            ...NOINDEX_ROUTE_PREFIXES.map((source) => ({
                source: `${source}/:path*`,
                headers: [NOINDEX_HEADER],
            })),
        ])
    })

    it('keeps personalized OG images private without suppressing marketing OG images', () => {
        expect(receivesNoindexHeader('/api/og')).toBe(true)
        expect(receivesNoindexHeader('/api/og/marketing')).toBe(false)
    })

    it.each(criticalAppRoutes)('keeps %s out of the index', (route) => {
        expect(NOINDEX_ROUTE_PREFIXES).toContain(route)
    })

    it('also applies noindex to every robots-disallowed page surface', () => {
        for (const path of ROBOTS_DISALLOWED_PATHS.filter((path) => path !== '/api/')) {
            expect(NOINDEX_ROUTE_PREFIXES).toContain(path.replace(/\/$/, ''))
        }
    })

    it.each(crawlablePublicRoutes)('does not suppress the public route %s', (route) => {
        expect(receivesNoindexHeader(route)).toBe(false)
    })

    it.each(['/home', '/home/activity', '/invite?code=abc&lid=campaign', '/api/og?type=send&username=alice&amount=10'])(
        'renders a noindex header for %s through Next route matching',
        async (route) => {
            await expect(renderedRobotsHeader(route)).resolves.toBe('noindex, nofollow')
        }
    )

    it.each(['/lp', '/api/og/marketing?title=Peanut', '/m/stain', '/en/pay-with/pix'])(
        'does not render a noindex header for %s through Next route matching',
        async (route) => {
            await expect(renderedRobotsHeader(route)).resolves.toBeNull()
        }
    )

    it('has no duplicate or malformed route entries', () => {
        expect(new Set(NOINDEX_ROUTE_PREFIXES).size).toBe(NOINDEX_ROUTE_PREFIXES.length)
        expect(new Set(NOINDEX_EXACT_ROUTES).size).toBe(NOINDEX_EXACT_ROUTES.length)
        expect(new Set(ROBOTS_DISALLOWED_PATHS).size).toBe(ROBOTS_DISALLOWED_PATHS.length)
        expect(new Set(GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS).size).toBe(GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS.length)

        for (const path of [...NOINDEX_ROUTE_PREFIXES, ...ROBOTS_DISALLOWED_PATHS]) {
            expect(path).toMatch(/^\/[a-z0-9/-]+\/?$/)
        }
    })

    it('keeps crawl exceptions narrowly scoped to exact indexed shells', () => {
        expect(GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS).toEqual([
            '/home$',
            '/profile$',
            '/send$',
            '/setup$',
            '/invite$',
            '/invite?code=',
        ])
    })
})
