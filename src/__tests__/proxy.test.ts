/** @jest-environment node */
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '@/proxy'
import { SPLIT_CANARY_GUIDE_PATHS, SPLIT_EDGE_MARKER_HEADER } from '@/utils/split-content-edge'

function runProxy(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    return proxy(new NextRequest(`https://peanut.me${path}`, init))
}

describe('API cache policy', () => {
    it('lets the exact exchange-rate route preserve its route-owned cache headers', () => {
        const response = runProxy('/api/exchange-rate?from=PLN&to=EUR')

        expect(response.headers.get('Cache-Control')).toBeNull()
        expect(response.headers.get('Pragma')).toBeNull()
        expect(response.headers.get('Expires')).toBeNull()
        expect(response.headers.get('Surrogate-Control')).toBeNull()
    })

    it.each(['/api/rooms', '/api/exchange-rate/', '/api/exchange-rate-history'])(
        'keeps no-store on every other API path: %s',
        (path) => {
            const response = runProxy(path)

            expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate')
            expect(response.headers.get('Pragma')).toBe('no-cache')
            expect(response.headers.get('Expires')).toBe('0')
            expect(response.headers.get('Surrogate-Control')).toBe('no-store')
        }
    )
})

describe('Split B2 edge foundation', () => {
    const marker = 'server-only-test-marker-at-least-32-bytes'
    const previous = {
        marker: process.env.SPLIT_CONTENT_EDGE_MARKER,
        origin: process.env.SPLIT_CONTENT_ORIGIN,
    }

    beforeEach(() => {
        process.env.SPLIT_CONTENT_EDGE_MARKER = marker
        process.env.SPLIT_CONTENT_ORIGIN = 'https://renderer.example'
    })

    afterAll(() => {
        restoreEnv('SPLIT_CONTENT_EDGE_MARKER', previous.marker)
        restoreEnv('SPLIT_CONTENT_ORIGIN', previous.origin)
    })

    it.each(SPLIT_CANARY_GUIDE_PATHS)('rewrites exact canary page %s to the same renderer path', (pathname) => {
        const response = runProxy(`${pathname}?utm_source=canary`)

        expect(isRewrite(response)).toBe(true)
        expect(getRewrittenUrl(response)).toBe(`https://renderer.example${pathname}?utm_source=canary`)
    })

    it.each([
        '/split-static/_next/static/chunks/app.js?v=digest',
        '/split-static/fonts/peanut.woff2',
        '/split-sitemap.xml',
    ])('rewrites support path and query without remapping it: %s', (path) => {
        expect(getRewrittenUrl(runProxy(path))).toBe(`https://renderer.example${path}`)
    })

    it.each([
        [SPLIT_CANARY_GUIDE_PATHS[0], {}],
        [`${SPLIT_CANARY_GUIDE_PATHS[1]}?_rsc=opaque`, { rsc: '1', 'next-router-state-tree': 'opaque-tree' }],
        ['/split-static/_next/static/chunks/app.js', { range: 'bytes=0-99' }],
        ['/split-sitemap.xml', { accept: 'application/xml' }],
    ] as const)('sanitizes every forwarded request class: %s', (path, classHeaders) => {
        const response = runProxy(path, {
            headers: {
                authorization: 'Bearer private',
                cookie: 'jwt-token=private',
                forwarded: 'for=private;host=spoof.example',
                host: 'spoof.example',
                'proxy-authorization': 'Basic private',
                [SPLIT_EDGE_MARKER_HEADER]: 'caller-spoof',
                'x-api-key': 'private-key',
                'x-forwarded-for': 'private-client-ip',
                'x-forwarded-host': 'spoof.example',
                'x-forwarded-port': '80',
                'x-forwarded-proto': 'http',
                'x-private-secret': 'private-value',
                'x-real-ip': 'private-client-ip',
                'x-vercel-forwarded-for': 'private-client-ip',
                'x-vercel-protection-bypass': 'private-bypass',
                ...classHeaders,
            },
        })

        for (const name of [
            'authorization',
            'cookie',
            'forwarded',
            'host',
            'proxy-authorization',
            'x-api-key',
            'x-forwarded-for',
            'x-forwarded-port',
            'x-forwarded-proto',
            'x-private-secret',
            'x-real-ip',
            'x-vercel-forwarded-for',
            'x-vercel-protection-bypass',
        ]) {
            expect(response.headers.get(`x-middleware-request-${name}`)).toBeNull()
        }
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBe(marker)
        expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBe('peanut.me')
        expect(response.headers.get(SPLIT_EDGE_MARKER_HEADER)).toBeNull()
    })

    it('preserves the RSC header, router state, and query through the rewrite', () => {
        const response = runProxy(`${SPLIT_CANARY_GUIDE_PATHS[0]}?_rsc=opaque`, {
            headers: {
                accept: 'text/x-component',
                rsc: '1',
                'next-router-prefetch': '1',
                'next-router-segment-prefetch': '/guide',
                'next-router-state-tree': 'opaque-tree',
                'next-url': '/en/split/guides/previous',
            },
        })

        expect(getRewrittenUrl(response)).toBe(`https://renderer.example${SPLIT_CANARY_GUIDE_PATHS[0]}?_rsc=opaque`)
        expect(response.headers.get('x-middleware-request-accept')).toBe('text/x-component')
        expect(response.headers.get('x-middleware-request-rsc')).toBe('1')
        expect(response.headers.get('x-middleware-request-next-router-prefetch')).toBe('1')
        expect(response.headers.get('x-middleware-request-next-router-segment-prefetch')).toBe('/guide')
        expect(response.headers.get('x-middleware-request-next-router-state-tree')).toBe('opaque-tree')
        expect(response.headers.get('x-middleware-request-next-url')).toBe('/en/split/guides/previous')
    })

    it.each([
        '/split',
        '/split/anything',
        '/en/split',
        '/en/split/guides/unknown',
        '/fr/split/guides/split-expenses-across-currencies',
        '/en/split/guides/split-expenses-across-currencies/extra',
        '/split-static',
        '/split-sitemap.xml/extra',
    ])('returns a true bodyless noindex 404 for negative namespace path %s', (pathname) => {
        const response = runProxy(pathname)

        expect(response.status).toBe(404)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
        expect(isRewrite(response)).toBe(false)
    })

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s on every forwarded class', (method) => {
        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/split-static/a.js', '/split-sitemap.xml']) {
            const response = runProxy(pathname, { method })
            expect(response.status).toBe(405)
            expect(response.body).toBeNull()
            expect(response.headers.get('allow')).toBe('GET, HEAD')
            expect(response.headers.get('x-robots-tag')).toContain('noindex')
            expect(isRewrite(response)).toBe(false)
        }
    })

    it.each(['GET', 'HEAD'])('allows %s on every forwarded class', (method) => {
        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/split-static/a.js', '/split-sitemap.xml']) {
            expect(isRewrite(runProxy(pathname, { method }))).toBe(true)
        }
    })

    it('is completely inert when both renderer values are absent', () => {
        delete process.env.SPLIT_CONTENT_EDGE_MARKER
        delete process.env.SPLIT_CONTENT_ORIGIN

        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/split', '/split-static/a.js', '/split-sitemap.xml']) {
            const response = runProxy(pathname)
            expect(response.status).toBe(200)
            expect(isRewrite(response)).toBe(false)
            expect(response.headers.get('x-robots-tag')).toBeNull()
        }
    })

    it.each([
        ['missing marker', undefined, 'https://renderer.example'],
        ['short marker', 'too-short', 'https://renderer.example'],
        ['insecure origin', marker, 'http://renderer.example'],
        ['origin with a path', marker, 'https://renderer.example/base'],
    ] as const)('fails closed without reflecting secrets for %s', (_label, configuredMarker, configuredOrigin) => {
        restoreEnv('SPLIT_CONTENT_EDGE_MARKER', configuredMarker)
        restoreEnv('SPLIT_CONTENT_ORIGIN', configuredOrigin)

        const response = runProxy(SPLIT_CANARY_GUIDE_PATHS[0])

        expect(response.status).toBe(503)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toContain('noindex')
        expect(response.headers.get(SPLIT_EDGE_MARKER_HEADER)).toBeNull()
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBeNull()
        expect(isRewrite(response)).toBe(false)
    })

    it('fails closed instead of recursively rewriting to the public origin', () => {
        process.env.SPLIT_CONTENT_ORIGIN = 'https://peanut.me'
        expect(runProxy(SPLIT_CANARY_GUIDE_PATHS[0]).status).toBe(503)
    })

    it('leaves unrelated product and marketing routes unchanged while configured', () => {
        for (const pathname of ['/home', '/en', '/splitter', '/en/splitter/page']) {
            expect(isRewrite(runProxy(pathname))).toBe(false)
        }
    })

    it.each([
        ...SPLIT_CANARY_GUIDE_PATHS,
        '/split',
        '/split/unknown',
        '/fr/split/guides/unknown',
        '/split-static',
        '/split-static/_next/a.js',
        '/split-sitemap.xml',
        '/split-sitemap.xml/extra',
    ])('matches Split path %s before filesystem and catch-all routing', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
    })
})

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
}
