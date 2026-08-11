/** @jest-environment node */
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '@/proxy'
import { SPLIT_EDGE_MARKER_HEADER } from '@/utils/split-content-edge'

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

describe('Split A2 preview transport', () => {
    const previous = {
        enabled: process.env.SPLIT_CONTENT_A2_CANARY_ENABLED,
        marker: process.env.SPLIT_CONTENT_EDGE_MARKER,
        origin: process.env.SPLIT_CONTENT_ORIGIN,
        proofOnly: process.env.SPLIT_CONTENT_A2_PROOF_ONLY,
        vercelEnv: process.env.VERCEL_ENV,
    }

    beforeEach(() => {
        process.env.SPLIT_CONTENT_A2_CANARY_ENABLED = '1'
        process.env.SPLIT_CONTENT_EDGE_MARKER = 'server-only-test-marker-32-bytes!!'
        process.env.SPLIT_CONTENT_ORIGIN = 'http://localhost:8765'
        process.env.VERCEL_ENV = 'preview'
        delete process.env.SPLIT_CONTENT_A2_PROOF_ONLY
    })

    afterAll(() => {
        restoreEnv('SPLIT_CONTENT_A2_CANARY_ENABLED', previous.enabled)
        restoreEnv('SPLIT_CONTENT_EDGE_MARKER', previous.marker)
        restoreEnv('SPLIT_CONTENT_ORIGIN', previous.origin)
        restoreEnv('SPLIT_CONTENT_A2_PROOF_ONLY', previous.proofOnly)
        restoreEnv('VERCEL_ENV', previous.vercelEnv)
    })

    it('rewrites the exact fixture and preserves its query', () => {
        const response = runProxy('/en/split/a2-transport?utm_source=a2')

        expect(isRewrite(response)).toBe(true)
        expect(getRewrittenUrl(response)).toBe('http://localhost:8765/en/split/a2-transport?utm_source=a2')
    })

    it.each(['/split-static/_next/static/chunks/a.js', '/split-sitemap.xml'])(
        'rewrites the forwarded support path %s',
        (path) => {
            expect(getRewrittenUrl(runProxy(path))).toBe(`http://localhost:8765${path}`)
        }
    )

    it('maps the exact preview-only cookie proof to a fixed upstream and strips private request headers', () => {
        const response = runProxy('/_split-a2/set-cookie?caller=cannot-change-upstream', {
            headers: {
                authorization: 'Bearer private',
                cookie: 'jwt-token=private',
                'proxy-authorization': 'Basic private',
                [SPLIT_EDGE_MARKER_HEADER]: 'caller-spoof',
                'x-api-key': 'private-key',
                'x-forwarded-host': 'spoof.example',
                'x-private-secret': 'private-value',
                'x-vercel-protection-bypass': 'private-bypass',
            },
        })
        const overriddenHeaders = (response.headers.get('x-middleware-override-headers')?.split(',') ?? []).sort()

        expect(getRewrittenUrl(response)).toBe(
            'https://httpbingo.org/response-headers?Set-Cookie=split-a2-first%3D1%3B%20Path%3D%2F&Set-Cookie=split-a2-second%3D2%3B%20Path%3D%2F'
        )
        expect(overriddenHeaders).toEqual(['x-split-a2-proof'])
        expect(response.headers.get('x-middleware-request-x-split-a2-proof')).toBe('set-cookie')
        expect(response.headers.get('x-middleware-request-authorization')).toBeNull()
        expect(response.headers.get('x-middleware-request-cookie')).toBeNull()
        expect(response.headers.get('x-middleware-request-proxy-authorization')).toBeNull()
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBeNull()
        expect(response.headers.get('x-middleware-request-x-api-key')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-private-secret')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-vercel-protection-bypass')).toBeNull()
    })

    it('maps the exact preview-only header proof without forwarding credentials or a server marker', () => {
        const response = runProxy('/_split-a2/headers?caller=cannot-change-upstream', {
            headers: {
                authorization: 'Bearer private',
                cookie: 'jwt-token=private',
                'proxy-authorization': 'Basic private',
                [SPLIT_EDGE_MARKER_HEADER]: 'caller-spoof',
                'x-api-key': 'private-key',
                'x-forwarded-for': 'private-client-ip',
                'x-forwarded-host': 'spoof.example',
                'x-private-secret': 'private-value',
                'x-real-ip': 'private-client-ip',
                'x-vercel-protection-bypass': 'private-bypass',
            },
        })
        const overriddenHeaders = (response.headers.get('x-middleware-override-headers')?.split(',') ?? []).sort()

        expect(getRewrittenUrl(response)).toBe('https://httpbingo.org/anything')
        expect(overriddenHeaders).toEqual(['x-forwarded-host', 'x-split-a2-proof'])
        expect(response.headers.get('x-middleware-request-x-split-a2-proof')).toBe('headers')
        expect(response.headers.get('x-middleware-request-authorization')).toBeNull()
        expect(response.headers.get('x-middleware-request-cookie')).toBeNull()
        expect(response.headers.get('x-middleware-request-proxy-authorization')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-api-key')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-forwarded-for')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-private-secret')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-real-ip')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-vercel-protection-bypass')).toBeNull()
        expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBe('peanut.me')
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBeNull()
    })

    it('never enables the cookie proof outside a Vercel preview', () => {
        process.env.VERCEL_ENV = 'development'

        const response = runProxy('/_split-a2/set-cookie')

        expect(response.status).toBe(404)
        expect(isRewrite(response)).toBe(false)
    })

    it('keeps the real renderer paths closed during an edge-only proof', () => {
        process.env.SPLIT_CONTENT_A2_PROOF_ONLY = '1'

        const fixture = runProxy('/en/split/a2-transport')
        const diagnostic = runProxy('/_split-a2/headers')

        expect(fixture.status).toBe(404)
        expect(isRewrite(fixture)).toBe(false)
        expect(getRewrittenUrl(diagnostic)).toBe('https://httpbingo.org/anything')
        delete process.env.SPLIT_CONTENT_A2_PROOF_ONLY
    })

    it.each([
        ['/en/split/a2-transport', {}],
        ['/en/split/a2-transport?_rsc=opaque', { rsc: '1' }],
        ['/split-static/_next/static/chunks/a.js', {}],
        ['/split-sitemap.xml', {}],
    ] as const)('sanitizes every forwarded request class: %s', (path, classHeaders) => {
        const response = runProxy(path, {
            headers: {
                authorization: 'Bearer private',
                cookie: 'jwt-token=private',
                [SPLIT_EDGE_MARKER_HEADER]: 'caller-spoof',
                'x-forwarded-host': 'spoof.example',
                ...classHeaders,
            },
        })
        const overriddenHeaders = response.headers.get('x-middleware-override-headers')?.split(',') ?? []

        expect(overriddenHeaders).not.toContain('authorization')
        expect(overriddenHeaders).not.toContain('cookie')
        expect(response.headers.get('x-middleware-request-authorization')).toBeNull()
        expect(response.headers.get('x-middleware-request-cookie')).toBeNull()
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBe(
            'server-only-test-marker-32-bytes!!'
        )
        expect(response.headers.get('x-middleware-request-x-forwarded-host')).toBe('peanut.me')
    })

    it.each(['/split', '/en/split/unknown', '/pt-br/split/a2-transport', '/split-static'])(
        'returns a real no-store 404 for negative namespace path %s',
        (path) => {
            const response = runProxy(path)

            expect(response.status).toBe(404)
            expect(response.headers.get('cache-control')).toBe('no-store')
            expect(isRewrite(response)).toBe(false)
        }
    )

    it('rejects non-read methods', () => {
        const response = runProxy('/en/split/a2-transport', { method: 'POST' })

        expect(response.status).toBe(405)
        expect(response.headers.get('allow')).toBe('GET, HEAD')
    })

    it.each([
        ['missing origin', 'SPLIT_CONTENT_ORIGIN'],
        ['missing marker', 'SPLIT_CONTENT_EDGE_MARKER'],
    ] as const)('fails closed with no marker reflection for %s', (_label, missingKey) => {
        delete process.env[missingKey]

        const response = runProxy('/en/split/a2-transport')

        expect(response.status).toBe(503)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(response.headers.get(SPLIT_EDGE_MARKER_HEADER)).toBeNull()
        expect(response.headers.get(`x-middleware-request-${SPLIT_EDGE_MARKER_HEADER}`)).toBeNull()
    })

    it('fails closed when the marker is shorter than 32 bytes', () => {
        process.env.SPLIT_CONTENT_EDGE_MARKER = 'too-short'

        expect(runProxy('/en/split/a2-transport').status).toBe(503)
    })

    it('stays inactive on production even if the canary switch is set', () => {
        process.env.VERCEL_ENV = 'production'

        const response = runProxy('/en/split/a2-transport')

        expect(isRewrite(response)).toBe(false)
        expect(response.status).toBe(200)
    })

    it('leaves unrelated routes unchanged', () => {
        expect(isRewrite(runProxy('/home'))).toBe(false)
    })

    it.each([
        '/en/split/a2-transport',
        '/pt-br/split/unknown',
        '/split',
        '/split-static/_next/a.js',
        '/split-sitemap.xml',
        '/_split-a2/headers',
        '/_split-a2/set-cookie',
    ])('matches Split path %s before filesystem routing', (url) => {
        expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
    })
})

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
}
