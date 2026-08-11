/** @jest-environment node */
import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
    SPLIT_EDGE_MARKER_HEADER,
    SPLIT_ENGLISH_CANARY_PATH,
    SPLIT_INDEX_RELEASE_HEADER,
    SPLIT_MANIFEST_SHA256_HEADER,
    SPLIT_RAW_ROUTE_HEADER,
    SPLIT_RAW_ROUTE_VALUE,
    SPLIT_RAW_UNSAFE_HEADER,
    SPLIT_RAW_UNSAFE_VALUE,
    classifySplitContentRequest,
    hasTrustedSplitRawRouteStamp,
    hasUnsafeSplitRawRouteStamp,
    isSupportedSplitContentPublicPath,
    resolveSplitContentEdgeConfig,
    resolveSplitContentRelease,
    splitContentIndexReleased,
    splitContentForwardHeaders,
} from '@/utils/split-content-edge'

const MARKER = 'split-content-test-marker-at-least-32-bytes'
const MANIFEST_SHA256 = '1'.repeat(64)
const EXPECTED_CANARY_PATHS = [
    '/en/split/guides/split-a-group-trip-across-countries',
    '/en/split/guides/split-expenses-across-currencies',
    '/es-419/split/guides/split-a-group-trip-across-countries',
    '/es-419/split/guides/split-expenses-across-currencies',
    '/pt-br/split/guides/split-a-group-trip-across-countries',
    '/pt-br/split/guides/split-expenses-across-currencies',
]

function releaseDocument(
    stage: 0 | 1 | 2 | 3,
    options: {
        index?: boolean
        schemaVersion?: 1 | 2 | 3
        manifestPaths?: string[]
        releasedPaths?: string[]
    } = {}
): string {
    const manifestPaths = options.manifestPaths ?? EXPECTED_CANARY_PATHS
    const releasedPaths =
        options.releasedPaths ?? (stage === 0 ? [] : stage === 1 ? [SPLIT_ENGLISH_CANARY_PATH] : manifestPaths)
    return JSON.stringify({
        version: SPLIT_CONTENT_RELEASE_DOCUMENT_VERSION,
        stage,
        index: options.index ?? false,
        manifest: {
            schema_version: options.schemaVersion ?? 1,
            sha256: MANIFEST_SHA256,
            public_paths: manifestPaths,
        },
        released_paths: releasedPaths,
    })
}

function readyRelease(stage: 0 | 1 | 2 | 3 = 2) {
    const resolved = resolveSplitContentRelease(releaseDocument(stage, { schemaVersion: stage === 3 ? 2 : 1 }))
    if (resolved.state !== 'ready') throw new Error(`Expected ready release, received ${resolved.state}`)
    return resolved.release
}

describe('Split manifest-backed edge route classification', () => {
    const releasedPaths = new Set(EXPECTED_CANARY_PATHS)

    it('records exactly the A1 two-slug, three-locale canary matrix without authorizing it', () => {
        expect(SPLIT_CANARY_GUIDE_PATHS).toEqual(EXPECTED_CANARY_PATHS)
    })

    it.each(EXPECTED_CANARY_PATHS)('forwards exact released page %s as HTML', (pathname) => {
        expect(classifySplitContentRequest(pathname, null, releasedPaths)).toEqual({
            action: 'forward',
            kind: 'html',
        })
    })

    it('preserves the RSC request class on every exact released page', () => {
        for (const pathname of EXPECTED_CANARY_PATHS) {
            expect(classifySplitContentRequest(pathname, '1', releasedPaths)).toEqual({
                action: 'forward',
                kind: 'rsc',
            })
        }
    })

    it.each(SPLIT_CANARY_GUIDE_PATHS)('keeps every released guide inside the owned Split namespace %s', (pathname) => {
        expect(classifySplitContentRequest(pathname, null).action).not.toBe('pass')
    })

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

    it.each([
        '/en/split',
        '/es-419/split',
        '/pt-br/split',
        '/en/split/guides/future-guide',
        '/pt-br/split/alternatives/splitwise',
        '/en/split/tools',
        '/en/split/tools/rent-split-calculator',
    ])('recognizes the finite future manifest route grammar: %s', (pathname) => {
        expect(isSupportedSplitContentPublicPath(pathname)).toBe(true)
    })

    it.each([
        '/fr/split',
        '/EN/split',
        '/en/split/',
        '/es-419/split/tools',
        '/pt-br/split/tools/rent',
        '/en/split/guides',
        '/en/split/guides/Bad-Slug',
        '/en/split/alternatives/a/b',
        '/en/split/unknown/a',
    ])('rejects paths outside the finite future manifest route grammar: %s', (pathname) => {
        expect(isSupportedSplitContentPublicPath(pathname)).toBe(false)
    })
})

describe('Split manifest-backed release configuration', () => {
    it('keeps an absent document at stage 0 and accepts exact canonical stage documents', () => {
        expect(resolveSplitContentRelease(undefined)).toEqual({ state: 'closed' })
        expect(resolveSplitContentRelease('')).toEqual({ state: 'closed' })

        const stage1 = resolveSplitContentRelease(releaseDocument(1))
        expect(stage1.state).toBe('ready')
        if (stage1.state === 'ready') {
            expect(stage1.release.stage).toBe(1)
            expect([...stage1.release.publicPaths]).toEqual([SPLIT_ENGLISH_CANARY_PATH])
            expect(stage1.release.indexReleased).toBe(false)
        }

        const stage2 = resolveSplitContentRelease(releaseDocument(2, { index: true }))
        expect(stage2.state).toBe('ready')
        if (stage2.state === 'ready') expect(stage2.release.indexReleased).toBe(true)

        const futurePaths = [...EXPECTED_CANARY_PATHS, '/en/split', '/en/split/tools'].sort()
        const stage3 = resolveSplitContentRelease(
            releaseDocument(3, { schemaVersion: 2, manifestPaths: futurePaths, releasedPaths: futurePaths })
        )
        expect(stage3.state).toBe('ready')
    })

    it.each([
        ['malformed JSON', '{'],
        ['noncanonical whitespace', `${releaseDocument(1)} `],
        ['unknown key', releaseDocument(1).replace('{', '{"unknown":true,')],
        ['alternate key order', JSON.stringify({ stage: 1, version: 1 })],
        ['zero digest', releaseDocument(1).replace(MANIFEST_SHA256, '0'.repeat(64))],
        ['uppercase digest', releaseDocument(1).replace(MANIFEST_SHA256, 'A'.repeat(64))],
        [
            'duplicate manifest path',
            releaseDocument(1, { manifestPaths: [EXPECTED_CANARY_PATHS[0], EXPECTED_CANARY_PATHS[0]] }),
        ],
        ['unsorted manifest paths', releaseDocument(1, { manifestPaths: [...EXPECTED_CANARY_PATHS].reverse() })],
        ['released path outside manifest', releaseDocument(1, { manifestPaths: EXPECTED_CANARY_PATHS.slice(1) })],
        ['stage zero release', releaseDocument(0, { releasedPaths: [SPLIT_ENGLISH_CANARY_PATH] })],
        ['stage one indexing', releaseDocument(1, { index: true })],
        ['stage one wrong path', releaseDocument(1, { releasedPaths: [EXPECTED_CANARY_PATHS[1]] })],
        ['stage two incomplete', releaseDocument(2, { releasedPaths: EXPECTED_CANARY_PATHS.slice(0, 5) })],
        ['stage three V1', releaseDocument(3)],
        [
            'stage three partial',
            releaseDocument(3, { schemaVersion: 2, releasedPaths: EXPECTED_CANARY_PATHS.slice(0, 5) }),
        ],
        [
            'indexing withheld manifest path',
            releaseDocument(2, {
                index: true,
                manifestPaths: [...EXPECTED_CANARY_PATHS, '/en/split'].sort(),
                releasedPaths: EXPECTED_CANARY_PATHS,
            }),
        ],
        ['V1 non-guide path', releaseDocument(2, { manifestPaths: [...EXPECTED_CANARY_PATHS, '/en/split'].sort() })],
        ['unsupported path', releaseDocument(3, { schemaVersion: 2, manifestPaths: ['/fr/split'] })],
    ])('fails closed for %s', (_label, value) => {
        expect(resolveSplitContentRelease(value)).toEqual({ state: 'invalid' })
        expect(splitContentIndexReleased(value)).toBe(false)
    })

    it('bounds both the canonical document bytes and manifest path cardinality', () => {
        const tooManyPaths = Array.from(
            { length: 513 },
            (_, index) => `/en/split/guides/generated-guide-${String(index).padStart(3, '0')}`
        )
        expect(
            resolveSplitContentRelease(
                releaseDocument(3, {
                    schemaVersion: 2,
                    manifestPaths: tooManyPaths,
                    releasedPaths: tooManyPaths,
                })
            )
        ).toEqual({ state: 'invalid' })

        const oversizedPath = `/en/split/guides/${'a'.repeat(33 * 1024)}`
        expect(
            resolveSplitContentRelease(
                releaseDocument(3, {
                    schemaVersion: 2,
                    manifestPaths: [oversizedPath],
                    releasedPaths: [oversizedPath],
                })
            )
        ).toEqual({ state: 'invalid' })
    })

    it('derives the robots/sitemap index bit only from a valid complete document', () => {
        expect(splitContentIndexReleased(releaseDocument(2, { index: true }))).toBe(true)
        expect(splitContentIndexReleased(releaseDocument(2))).toBe(false)
        expect(splitContentIndexReleased(undefined)).toBe(false)
    })
})

describe('Split edge transport configuration', () => {
    it('is inert only when both values are fully absent', () => {
        expect(resolveSplitContentEdgeConfig(undefined, undefined)).toEqual({ state: 'disabled' })
        expect(resolveSplitContentEdgeConfig('', '')).toEqual({ state: 'disabled' })
        expect(resolveSplitContentEdgeConfig('https://renderer.example', undefined)).toEqual({ state: 'invalid' })
        expect(resolveSplitContentEdgeConfig(undefined, MARKER)).toEqual({ state: 'invalid' })
        expect(resolveSplitContentEdgeConfig(undefined, undefined, releaseDocument(1))).toEqual({ state: 'invalid' })
    })

    it('accepts only an HTTPS origin without credentials, path, query, or fragment', () => {
        expect(resolveSplitContentEdgeConfig('https://renderer.example', MARKER)).toEqual({
            state: 'ready',
            marker: MARKER,
            origin: new URL('https://renderer.example'),
            release: null,
        })

        const configured = resolveSplitContentEdgeConfig('https://renderer.example', MARKER, releaseDocument(1))
        expect(configured.state).toBe('ready')
        if (configured.state === 'ready') expect(configured.release?.stage).toBe(1)

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

    it('fails closed when the release document is present but malformed', () => {
        expect(resolveSplitContentEdgeConfig('https://renderer.example', MARKER, '{')).toEqual({ state: 'invalid' })
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
            [SPLIT_MANIFEST_SHA256_HEADER]: 'caller-spoof',
            [SPLIT_INDEX_RELEASE_HEADER]: '1',
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

        const forwarded = splitContentForwardHeaders(requestHeaders, 'peanut.me', MARKER, readyRelease())

        expect(Object.fromEntries(forwarded)).toEqual({
            accept: 'text/x-component',
            'accept-language': 'es-419',
            'next-router-prefetch': '1',
            'next-router-segment-prefetch': '/segment',
            'next-router-state-tree': 'opaque-tree',
            'next-url': '/previous',
            rsc: '1',
            [SPLIT_EDGE_MARKER_HEADER]: MARKER,
            [SPLIT_INDEX_RELEASE_HEADER]: '0',
            [SPLIT_MANIFEST_SHA256_HEADER]: MANIFEST_SHA256,
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
            MARKER,
            readyRelease()
        )

        expect(forwarded.get('if-modified-since')).toBe('Wed, 21 Oct 2015 07:28:00 GMT')
        expect(forwarded.get('if-none-match')).toBe('"digest"')
        expect(forwarded.get('range')).toBe('bytes=0-99')
        expect(forwarded.get('x-arbitrary')).toBeNull()
        expect(forwarded.get('x-forwarded-host')).toBe('preview.example')
    })
})
