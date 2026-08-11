/** @jest-environment node */
import {
    SPLIT_EDGE_MARKER_HEADER,
    SPLIT_RELEASED_GUIDE_PATHS,
    SPLIT_RAW_ROUTE_HEADER,
    SPLIT_RAW_ROUTE_VALUE,
    SPLIT_RAW_UNSAFE_HEADER,
    SPLIT_RAW_UNSAFE_VALUE,
    classifySplitContentRequest,
    hasTrustedSplitRawRouteStamp,
    hasUnsafeSplitRawRouteStamp,
    resolveSplitContentEdgeConfig,
    splitContentForwardHeaders,
} from '@/utils/split-content-edge'

const MARKER = 'split-content-test-marker-at-least-32-bytes'

describe('Split B3b edge route classification', () => {
    const expectedReleasedPaths = [
        '/en/split/guides/split-a-group-trip-across-countries',
        '/es-419/split/guides/split-a-group-trip-across-countries',
        '/pt-br/split/guides/split-a-group-trip-across-countries',
        '/en/split/guides/split-expenses-across-currencies',
        '/es-419/split/guides/split-expenses-across-currencies',
        '/pt-br/split/guides/split-expenses-across-currencies',
    ]

    it('releases exactly the A1 two-slug, three-locale matrix', () => {
        expect(SPLIT_RELEASED_GUIDE_PATHS).toEqual(expectedReleasedPaths)
    })

    it.each(expectedReleasedPaths)('forwards exact released page %s as HTML', (pathname) => {
        expect(classifySplitContentRequest(pathname, null)).toEqual({ action: 'forward', kind: 'html' })
    })

    it('preserves the RSC request class on every exact released page', () => {
        for (const pathname of expectedReleasedPaths) {
            expect(classifySplitContentRequest(pathname, '1')).toEqual({ action: 'forward', kind: 'rsc' })
        }
    })

    it.each(SPLIT_RELEASED_GUIDE_PATHS)(
        'keeps every released guide inside the owned Split namespace %s',
        (pathname) => {
            expect(classifySplitContentRequest(pathname, null).action).not.toBe('pass')
        }
    )

    it.each([
        ['/split-static/_next/static/chunks/app.js', 'asset'],
        ['/split-static/fonts/peanut.woff2', 'asset'],
        ['/split-sitemap.xml', 'sitemap'],
    ] as const)('forwards support path %s as %s', (pathname, kind) => {
        expect(classifySplitContentRequest(pathname, null)).toEqual({ action: 'forward', kind })
    })

    it.each([
        '/split',
        '/split/anything',
        '/en/split',
        '/en/split/guides/unknown',
        '/en/split/guides/split-expenses-across-currencies/extra',
        '/fr/split/guides/split-expenses-across-currencies',
        '/es-ar/split/guides/split-expenses-across-currencies',
        '/EN/split/guides/split-expenses-across-currencies',
        '/SPLIT',
        '/SPLIT/anything',
        '/EN/SPLIT/guides/split-expenses-across-currencies',
        '/split-static',
        '/SPLIT-STATIC/a.js',
        '/Split-Static/a.js',
        '/SPLIT-SITEMAP.XML',
        '/split-sitemap.xml/extra',
    ])('firewalls unowned Split namespace path %s', (pathname) => {
        expect(classifySplitContentRequest(pathname, null)).toEqual({ action: 'not-found' })
    })

    it.each([
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
    ])('rejects non-canonical encoded Split representation %s', (pathname) => {
        expect(classifySplitContentRequest(pathname, null)).toEqual({ action: 'not-found' })
    })

    it.each([
        '/splitter',
        '/en/splitter/page',
        '/foo/split-static/a.js',
        '/split-sitemap.xmlx',
        '/en/travel%20guide',
        '/home',
    ])('passes unrelated path %s', (pathname) => {
        expect(classifySplitContentRequest(pathname, null)).toEqual({ action: 'pass' })
    })
})

describe('Split B3b edge configuration', () => {
    it('is inert only when both values are fully absent', () => {
        expect(resolveSplitContentEdgeConfig(undefined, undefined)).toEqual({ state: 'disabled' })
        expect(resolveSplitContentEdgeConfig('', '')).toEqual({ state: 'disabled' })
        expect(resolveSplitContentEdgeConfig('https://renderer.example', undefined)).toEqual({ state: 'invalid' })
        expect(resolveSplitContentEdgeConfig(undefined, MARKER)).toEqual({ state: 'invalid' })
    })

    it('accepts only an HTTPS origin without credentials, path, query, or fragment', () => {
        expect(resolveSplitContentEdgeConfig('https://renderer.example', MARKER)).toEqual({
            state: 'ready',
            marker: MARKER,
            origin: new URL('https://renderer.example'),
        })

        for (const origin of [
            'http://renderer.example',
            'http://localhost:8777',
            'ftp://renderer.example',
            'https://user:pass@renderer.example',
            'https://renderer.example/base',
            'https://renderer.example?token=x',
            'https://renderer.example#fragment',
            'not a URL',
        ]) {
            expect(resolveSplitContentEdgeConfig(origin, MARKER)).toEqual({ state: 'invalid' })
        }
    })

    it('requires at least 32 printable ASCII bytes for the header marker', () => {
        expect(resolveSplitContentEdgeConfig('https://renderer.example', 'a'.repeat(31))).toEqual({ state: 'invalid' })
        expect(resolveSplitContentEdgeConfig('https://renderer.example', 'a'.repeat(32)).state).toBe('ready')
        expect(resolveSplitContentEdgeConfig('https://renderer.example', ` ${'a'.repeat(32)}`)).toEqual({
            state: 'invalid',
        })
        expect(resolveSplitContentEdgeConfig('https://renderer.example', `a\n${'b'.repeat(32)}`)).toEqual({
            state: 'invalid',
        })
        expect(resolveSplitContentEdgeConfig('https://renderer.example', '🔐'.repeat(16))).toEqual({ state: 'invalid' })
    })
})

describe('Split B3b request-header boundary', () => {
    it('accepts only the exact Vercel raw-route stamp', () => {
        expect(hasTrustedSplitRawRouteStamp(new Headers({ [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE }))).toBe(
            true
        )

        for (const value of ['', 'caller-spoof', `${SPLIT_RAW_ROUTE_VALUE}, caller-spoof`]) {
            expect(hasTrustedSplitRawRouteStamp(new Headers({ [SPLIT_RAW_ROUTE_HEADER]: value }))).toBe(false)
        }
        expect(hasTrustedSplitRawRouteStamp(new Headers())).toBe(false)
    })

    it('accepts only the exact Vercel unsafe raw-path stamp', () => {
        expect(hasUnsafeSplitRawRouteStamp(new Headers({ [SPLIT_RAW_UNSAFE_HEADER]: SPLIT_RAW_UNSAFE_VALUE }))).toBe(
            true
        )

        for (const value of ['', 'caller-spoof', `${SPLIT_RAW_UNSAFE_VALUE}, caller-spoof`]) {
            expect(hasUnsafeSplitRawRouteStamp(new Headers({ [SPLIT_RAW_UNSAFE_HEADER]: value }))).toBe(false)
        }
        expect(hasUnsafeSplitRawRouteStamp(new Headers())).toBe(false)
    })

    it('preserves public negotiation and Flight state but replaces all caller routing and credentials', () => {
        const requestHeaders = new Headers({
            accept: 'text/x-component',
            'accept-language': 'es-419',
            authorization: 'Bearer private',
            cookie: 'jwt-token=private',
            forwarded: 'for=private;host=spoof.example;proto=http',
            host: 'spoof.example',
            'next-router-prefetch': '1',
            'next-router-segment-prefetch': '/segment',
            'next-router-state-tree': 'opaque-tree',
            'next-url': '/previous',
            'proxy-authorization': 'Basic private',
            rsc: '1',
            [SPLIT_EDGE_MARKER_HEADER]: 'caller-spoof',
            [SPLIT_RAW_ROUTE_HEADER]: SPLIT_RAW_ROUTE_VALUE,
            [SPLIT_RAW_UNSAFE_HEADER]: SPLIT_RAW_UNSAFE_VALUE,
            'x-api-key': 'private-key',
            'x-forwarded-for': 'private-client-ip',
            'x-forwarded-host': 'spoof.example',
            'x-forwarded-port': '80',
            'x-forwarded-proto': 'http',
            'x-private-secret': 'private-value',
            'x-real-ip': 'private-client-ip',
            'x-vercel-forwarded-for': 'private-client-ip',
            'x-vercel-protection-bypass': 'private-bypass',
        })

        const forwarded = splitContentForwardHeaders(requestHeaders, 'peanut.me', MARKER)

        expect(Object.fromEntries(forwarded)).toEqual({
            accept: 'text/x-component',
            'accept-language': 'es-419',
            'next-router-prefetch': '1',
            'next-router-segment-prefetch': '/segment',
            'next-router-state-tree': 'opaque-tree',
            'next-url': '/previous',
            rsc: '1',
            [SPLIT_EDGE_MARKER_HEADER]: MARKER,
            'x-forwarded-host': 'peanut.me',
        })
        expect([...forwarded.values()].join('\n')).not.toContain('private')
        expect([...forwarded.values()].join('\n')).not.toContain('spoof.example')
        expect(forwarded.get(SPLIT_RAW_ROUTE_HEADER)).toBeNull()
        expect(forwarded.get(SPLIT_RAW_UNSAFE_HEADER)).toBeNull()
    })

    it('keeps asset validators and ranges without carrying arbitrary headers', () => {
        const forwarded = splitContentForwardHeaders(
            new Headers({
                'if-modified-since': 'Wed, 21 Oct 2015 07:28:00 GMT',
                'if-none-match': '"digest"',
                range: 'bytes=0-99',
                'x-arbitrary': 'drop-me',
            }),
            'preview.example',
            MARKER
        )

        expect(forwarded.get('if-modified-since')).toBe('Wed, 21 Oct 2015 07:28:00 GMT')
        expect(forwarded.get('if-none-match')).toBe('"digest"')
        expect(forwarded.get('range')).toBe('bytes=0-99')
        expect(forwarded.get('x-arbitrary')).toBeNull()
        expect(forwarded.get('x-forwarded-host')).toBe('preview.example')
    })
})
