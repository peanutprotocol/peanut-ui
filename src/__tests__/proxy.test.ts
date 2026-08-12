/** @jest-environment node */
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '@/proxy'
import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RESERVED_PATH_PREFIXES,
    SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
    SPLIT_EDGE_MARKER_HEADER,
    SPLIT_ENGLISH_CANARY_PATH,
    SPLIT_INDEX_RELEASE_HEADER,
    SPLIT_MANIFEST_SHA256_HEADER,
    SPLIT_RAW_ROUTE_HEADER,
    SPLIT_RAW_ROUTE_VALUE,
    SPLIT_RAW_UNSAFE_HEADER,
    SPLIT_RAW_UNSAFE_VALUE,
} from '@/utils/split-content-edge'

const MANIFEST_SHA256 = '1'.repeat(64)

function releaseDocument(
    stage: 0 | 1 | 2 | 3,
    options: {
        index?: boolean
        schemaVersion?: 1 | 2 | 3
        sha256s?: string[]
        manifestPaths?: string[]
        releasedPaths?: string[]
    } = {}
): string {
    const manifestPaths = options.manifestPaths ?? [...SPLIT_CANARY_GUIDE_PATHS]
    const releasedPaths =
        options.releasedPaths ?? (stage === 0 ? [] : stage === 1 ? [SPLIT_ENGLISH_CANARY_PATH] : manifestPaths)
    return JSON.stringify({
        version: SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
        stage,
        index: options.index ?? false,
        manifest: {
            schema_version: options.schemaVersion ?? 1,
            sha256s: options.sha256s ?? [MANIFEST_SHA256],
            public_paths: manifestPaths,
        },
        released_paths: releasedPaths,
    })
}

function runProxy(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    return proxy(new NextRequest(`https://peanut.me${path}`, init))
}

function runCanonicalSplitProxy(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    const headers = new Headers(init?.headers)
    headers.set(SPLIT_RAW_ROUTE_HEADER, SPLIT_RAW_ROUTE_VALUE)
    return runProxy(path, { ...init, headers })
}

function runUnsafeRawProxy(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    const headers = new Headers(init?.headers)
    headers.set(SPLIT_RAW_UNSAFE_HEADER, SPLIT_RAW_UNSAFE_VALUE)
    return runProxy(path, { ...init, headers })
}

function alternatingCase(value: string): string {
    return [...value].map((character, index) => (index % 2 === 0 ? character : character.toUpperCase())).join('')
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

describe('Split manifest-backed production edge', () => {
    const marker = 'server-only-test-marker-at-least-32-bytes'
    const previous = {
        marker: process.env.SPLIT_CONTENT_EDGE_MARKER,
        origin: process.env.SPLIT_CONTENT_ORIGIN,
        release: process.env.SPLIT_CONTENT_RELEASE_DOCUMENT,
    }

    beforeEach(() => {
        process.env.SPLIT_CONTENT_EDGE_MARKER = marker
        process.env.SPLIT_CONTENT_ORIGIN = 'https://renderer.example'
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(2)
    })

    afterAll(() => {
        restoreEnv('SPLIT_CONTENT_EDGE_MARKER', previous.marker)
        restoreEnv('SPLIT_CONTENT_ORIGIN', previous.origin)
        restoreEnv('SPLIT_CONTENT_RELEASE_DOCUMENT', previous.release)
    })

    it.each(SPLIT_CANARY_GUIDE_PATHS)('rewrites exact released page %s to the same renderer path', (pathname) => {
        const response = runCanonicalSplitProxy(`${pathname}?utm_source=production`)

        expect(isRewrite(response)).toBe(true)
        expect(getRewrittenUrl(response)).toBe(`https://renderer.example${pathname}?utm_source=production`)
    })

    it.each([undefined, releaseDocument(0)])(
        'keeps both missing and explicit stage 0 fully dark even when transport credentials are ready',
        (release) => {
            if (release === undefined) delete process.env.SPLIT_CONTENT_RELEASE_DOCUMENT
            else process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = release

            for (const pathname of [SPLIT_ENGLISH_CANARY_PATH, '/split-static/a.js', '/split-sitemap.xml']) {
                const response = runCanonicalSplitProxy(pathname)
                expect(response.status).toBe(404)
                expect(response.body).toBeNull()
                expect(response.headers.get('cache-control')).toBe('private, no-store')
                expect(response.headers.get('x-robots-tag')).toContain('noindex')
                expect(isRewrite(response)).toBe(false)
            }
        }
    )

    it('releases exactly one English canary at stage 1', () => {
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(1)

        expect(isRewrite(runCanonicalSplitProxy(SPLIT_ENGLISH_CANARY_PATH))).toBe(true)
        for (const pathname of SPLIT_CANARY_GUIDE_PATHS.slice(1)) {
            const response = runCanonicalSplitProxy(pathname)
            expect(response.status).toBe(404)
            expect(isRewrite(response)).toBe(false)
        }
    })

    it('releases only exact manifest-backed future routes at stage 3', () => {
        const futurePaths = [
            ...SPLIT_CANARY_GUIDE_PATHS,
            '/en/split',
            '/en/split/alternatives/splitwise',
            '/en/split/tools',
            '/en/split/tools/rent',
            '/es-419/split/tools',
            '/pt-br/split/tools/mileage-split-calculator',
            '/zh-hans-cn/split/guides/future-guide',
        ].sort()
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(3, {
            schemaVersion: 2,
            manifestPaths: futurePaths,
            releasedPaths: futurePaths,
        })

        for (const pathname of futurePaths) expect(isRewrite(runCanonicalSplitProxy(pathname))).toBe(true)
        expect(runCanonicalSplitProxy('/en/split/tools/unknown').status).toBe(404)
        expect(runCanonicalSplitProxy('/fr/split/tools').status).toBe(404)
    })

    it('returns a private 503 for a malformed release document', () => {
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = '{'
        const response = runCanonicalSplitProxy(SPLIT_ENGLISH_CANARY_PATH)

        expect(response.status).toBe(503)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toContain('noindex')
    })

    it.each(['/split-static/_next/static/chunks/app.js?v=digest', '/split-static/fonts/peanut.woff2'])(
        'rewrites support path and query without remapping it: %s',
        (path) => {
            expect(getRewrittenUrl(runCanonicalSplitProxy(path))).toBe(`https://renderer.example${path}`)
        }
    )

    it('keeps the Split sitemap dark until the same release document enables indexing', () => {
        expect(runCanonicalSplitProxy('/split-sitemap.xml').status).toBe(404)
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(2, { index: true })
        expect(getRewrittenUrl(runCanonicalSplitProxy('/split-sitemap.xml'))).toBe(
            'https://renderer.example/split-sitemap.xml'
        )
    })

    it.each([
        [SPLIT_CANARY_GUIDE_PATHS[0], {}],
        [`${SPLIT_CANARY_GUIDE_PATHS[0]}?_rsc=opaque`, { rsc: '1', 'next-router-state-tree': 'opaque-tree' }],
        ['/split-static/_next/static/chunks/app.js', { range: 'bytes=0-99' }],
        ['/split-sitemap.xml', { accept: 'application/xml' }],
    ] as const)('sanitizes every forwarded request class: %s', (path, classHeaders) => {
        const indexReleased = path === '/split-sitemap.xml'
        if (indexReleased) process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(2, { index: true })
        const response = runCanonicalSplitProxy(path, {
            headers: {
                authorization: 'Bearer private',
                cookie: 'jwt-token=private',
                forwarded: 'for=private;host=spoof.example',
                host: 'spoof.example',
                'proxy-authorization': 'Basic private',
                [SPLIT_MANIFEST_SHA256_HEADER]: 'caller-spoof',
                [SPLIT_INDEX_RELEASE_HEADER]: '1',
                [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE,
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
        expect(response.headers.get(`x-middleware-request-${SPLIT_MANIFEST_SHA256_HEADER}`)).toBe(MANIFEST_SHA256)
        expect(response.headers.get(`x-middleware-request-${SPLIT_INDEX_RELEASE_HEADER}`)).toBe(
            indexReleased ? '1' : '0'
        )
        expect(response.headers.get(`x-middleware-request-${SPLIT_RAW_ROUTE_HEADER}`)).toBeNull()
        expect(response.headers.get(`x-middleware-request-${SPLIT_RAW_UNSAFE_HEADER}`)).toBeNull()
        expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBe('peanut.me')
        expect(response.headers.get(SPLIT_EDGE_MARKER_HEADER)).toBeNull()
    })

    it('preserves the RSC header, router state, and query through the rewrite', () => {
        const response = runCanonicalSplitProxy(`${SPLIT_CANARY_GUIDE_PATHS[0]}?_rsc=opaque`, {
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

    it.each(['caller-spoof', marker])('stops an inbound renderer marker before any rewrite: %s', (inboundMarker) => {
        const response = runCanonicalSplitProxy(SPLIT_CANARY_GUIDE_PATHS[0], {
            headers: { [SPLIT_EDGE_MARKER_HEADER]: inboundMarker },
        })

        expect(response.status).toBe(503)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
        expect(isRewrite(response)).toBe(false)
    })

    it('keeps an inbound renderer marker inert on an unrelated product route', () => {
        const response = runProxy('/home', { headers: { [SPLIT_EDGE_MARKER_HEADER]: marker } })

        expect(response.status).toBe(200)
        expect(response.headers.get('x-robots-tag')).toBeNull()
        expect(isRewrite(response)).toBe(false)
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

    const encodedSplitPaths = [
        '/en/%73plit/guides/unknown',
        '/en/split%2Fguides/unknown',
        '/en/%2Fsplit/guides/unknown',
        '/en/split/guides/split-expenses-across-currenc%69es',
        '/%2Fsplit-static/a.js',
        '/split%2Dstatic/a.js',
        '/split%2Dsitemap.xml',
        '/en/%2573plit/guides/unknown',
        '/foo/%252e%252e/split-static/a.js',
        '/en/foo%2F%2F..%2Fsplit/guides/unknown',
        '/en/foo%5C..%5Csplit/guides/unknown',
        '/en/%73plit%ZZ/guides/unknown',
        `/en/%${'25'.repeat(9)}73plit/guides/unknown`,
    ]

    it.each(encodedSplitPaths)('returns a true bodyless noindex 404 for encoded Split path %s', (pathname) => {
        const response = runProxy(pathname)

        expect(response.status).toBe(404)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
        expect(isRewrite(response)).toBe(false)
    })

    it.each([
        '/es/%73plit/guides/unknown',
        '/pt/s%70lit/tools/unknown',
        '/es-es/%2573plit/guides/unknown',
        '/sh/%73plit/guides/unknown',
        '/es/foo%5c..%5csplit/guides/unknown',
        '/sh/foo\\..\\split/guides/unknown',
    ])('fails a freed-locale raw Split alias closed after redirects decline it: %s', (pathname) => {
        const response = runProxy(pathname)

        expect(response.status).toBe(404)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
        expect(isRewrite(response)).toBe(false)
    })

    it('fails a freed-locale raw Split alias closed under partial configuration', () => {
        delete process.env.SPLIT_CONTENT_EDGE_MARKER

        const response = runProxy('/es/%73plit/guides/unknown')

        expect(response.status).toBe(503)
        expect(response.body).toBeNull()
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
        expect(isRewrite(response)).toBe(false)
    })

    it.each([SPLIT_CANARY_GUIDE_PATHS[0], '/split-static/a.js', '/split-sitemap.xml'])(
        'rejects normalized alias target %s when the raw-route stamp is absent or spoofed',
        (pathname) => {
            for (const spoofedValue of [undefined, 'caller-spoof', `${SPLIT_RAW_ROUTE_VALUE}, caller-spoof`]) {
                const headers = new Headers()
                if (spoofedValue) headers.set(SPLIT_RAW_ROUTE_HEADER, spoofedValue)
                const response = runProxy(pathname, { headers })

                expect(response.status).toBe(404)
                expect(response.body).toBeNull()
                expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
                expect(isRewrite(response)).toBe(false)
            }
        }
    )

    it.each(['/home', '/', '/api/exchange-rate', '/totally-unmatched-route'])(
        'rejects an unsafe raw path even when Next normalized it to unrelated route %s',
        (pathname) => {
            const response = runUnsafeRawProxy(pathname)

            expect(response.status).toBe(404)
            expect(response.body).toBeNull()
            expect(response.headers.get('cache-control')).toBe('private, no-store')
            expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
            expect(isRewrite(response)).toBe(false)
        }
    )

    it('lets the unsafe stamp win over a canonical stamp', () => {
        const response = runUnsafeRawProxy(SPLIT_CANARY_GUIDE_PATHS[0], {
            headers: { [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE },
        })

        expect(response.status).toBe(404)
        expect(response.body).toBeNull()
        expect(isRewrite(response)).toBe(false)
    })

    it('fails an unsafe raw path closed under partial configuration', () => {
        delete process.env.SPLIT_CONTENT_EDGE_MARKER

        const response = runUnsafeRawProxy('/home')

        expect(response.status).toBe(503)
        expect(response.body).toBeNull()
        expect(response.headers.get('x-robots-tag')).toContain('noindex')
        expect(isRewrite(response)).toBe(false)
    })

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s on every forwarded class', (method) => {
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(2, { index: true })
        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/split-static/a.js', '/split-sitemap.xml']) {
            const response = runCanonicalSplitProxy(pathname, { method })
            expect(response.status).toBe(405)
            expect(response.body).toBeNull()
            expect(response.headers.get('allow')).toBe('GET, HEAD')
            expect(response.headers.get('x-robots-tag')).toContain('noindex')
            expect(isRewrite(response)).toBe(false)
        }
    })

    it.each(['GET', 'HEAD'])('allows %s on every forwarded class', (method) => {
        process.env.SPLIT_CONTENT_RELEASE_DOCUMENT = releaseDocument(2, { index: true })
        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/split-static/a.js', '/split-sitemap.xml']) {
            expect(isRewrite(runCanonicalSplitProxy(pathname, { method }))).toBe(true)
        }
    })

    it('is completely inert when both renderer values are absent', () => {
        delete process.env.SPLIT_CONTENT_EDGE_MARKER
        delete process.env.SPLIT_CONTENT_ORIGIN
        delete process.env.SPLIT_CONTENT_RELEASE_DOCUMENT

        for (const pathname of [
            SPLIT_CANARY_GUIDE_PATHS[0],
            '/en/%73plit/guides/unknown',
            '/es/%73plit/guides/unknown',
            '/sh/foo\\..\\split/guides/unknown',
            '/split',
            '/split-static/a.js',
            '/split-sitemap.xml',
        ]) {
            const response = runProxy(pathname)
            expect(response.status).toBe(200)
            expect(isRewrite(response)).toBe(false)
            expect(response.headers.get('x-robots-tag')).toBeNull()
        }

        for (const pathname of [SPLIT_CANARY_GUIDE_PATHS[0], '/en/%73plit/guides/unknown']) {
            const response = runProxy(`${pathname}?promo=x&id=y`)
            expect(response.status).toBe(200)
            expect(response.headers.get('location')).toBeNull()
        }

        const unsafeResponse = runUnsafeRawProxy('/totally-unmatched-route')
        expect(unsafeResponse.status).toBe(200)
        expect(isRewrite(unsafeResponse)).toBe(false)
        expect(unsafeResponse.headers.get('x-robots-tag')).toBeNull()

        const markerResponse = runProxy(SPLIT_CANARY_GUIDE_PATHS[0], {
            headers: { [SPLIT_EDGE_MARKER_HEADER]: marker },
        })
        expect(markerResponse.status).toBe(200)
        expect(isRewrite(markerResponse)).toBe(false)
        expect(markerResponse.headers.get('x-robots-tag')).toBeNull()
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
        expect(runCanonicalSplitProxy(SPLIT_CANARY_GUIDE_PATHS[0]).status).toBe(503)
    })

    it.each(['/home', '/en', '/splitter', '/en/splitter/page', '/hugo/split', '/alice/split'])(
        'leaves unrelated product and marketing route %s unchanged while configured',
        (pathname) => {
            expect(isRewrite(runProxy(pathname))).toBe(false)
        }
    )

    it.each(SPLIT_CONTENT_RESERVED_PATH_PREFIXES)('never claims the existing product namespace %s/split', (prefix) => {
        const response = runProxy(`${prefix}/split`)

        expect(response.status).toBe(200)
        expect(response.headers.get('x-robots-tag')).toBeNull()
        expect(isRewrite(response)).toBe(false)
    })

    it.each([
        ...SPLIT_CANARY_GUIDE_PATHS,
        '/en/split/alternatives/splitwise',
        '/en/split/tools/rent-split-calculator',
        '/es-es/split/tools/rent-split-calculator',
        '/fr/split/tools',
        '/sh/split/guides/future-guide',
        '/zh-hans-cn/split/guides/future-guide',
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

    it.each(['/pay/split', '/qr/split', '/p/split', '/api/split', '/dev/split', '/c/split'])(
        'retains the pre-existing proxy matcher for reserved product path %s',
        (url) => {
            expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
        }
    )

    const supplementalReservedPaths = [
        ...['app', 'faq', 'kyc', 'lp', 'pay-with', 'sdk'].flatMap((segment) => [
            `/${segment}/split`,
            `/${alternatingCase(segment)}/SpLiT`,
            `/${segment.toUpperCase()}/SPLIT`,
        ]),
        ...['api', 'dev', 'pay', 'qr'].flatMap((segment) => [
            `/${alternatingCase(segment)}/SpLiT`,
            `/${segment.toUpperCase()}/SPLIT`,
        ]),
    ]

    it.each([
        ...supplementalReservedPaths,
        '/abcd/split',
        '/hugo/split',
        '/alice/split',
        '/locale/split',
        '/english/split/guides/unknown',
    ])('does not add proxy coverage for non-locale first segment %s', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false)
    })

    it.each(supplementalReservedPaths)('keeps reserved route %s outside supplemental promo handling', (url) => {
        expect(
            unstable_doesMiddlewareMatch({
                config,
                nextConfig: {},
                url: `${url}?promo=x&id=y`,
            })
        ).toBe(false)
    })

    it.each(['/SPLIT', '/SPLIT/unknown', '/EN/SPLIT/unknown', '/SPLIT-STATIC/a.js', '/SPLIT-SITEMAP.XML'])(
        'matches case-variant Split namespace %s before catch-all routing',
        (url) => {
            expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
        }
    )

    it('matches an arbitrary normalized path only when Vercel supplies the unsafe raw-path stamp', () => {
        const url = '/totally-unmatched-route'
        expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false)
        expect(
            unstable_doesMiddlewareMatch({
                config,
                nextConfig: {},
                url,
                headers: { [SPLIT_RAW_UNSAFE_HEADER]: SPLIT_RAW_UNSAFE_VALUE },
            })
        ).toBe(true)
    })

    it.each(encodedSplitPaths)('matches encoded Split path %s before filesystem and catch-all routing', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
    })

    it.each(['/en/travel%20guide', '/es-419/pagar%20con/efectivo'])(
        'passes unrelated supplemental encoded match %s directly to the app router',
        (pathname) => {
            const response = runProxy(`${pathname}?promo=x&id=y`)
            expect(response.status).toBe(200)
            expect(isRewrite(response)).toBe(false)
            expect(response.headers.get('x-robots-tag')).toBeNull()
            expect(response.headers.get('location')).toBeNull()
        }
    )

    it('preserves legacy proxy behavior for encoded paths inside an original matcher namespace', () => {
        const response = runProxy('/api/rooms%20archive')
        expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate')
    })
})

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
}
