import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800'

let rules: HeaderRule[]

beforeAll(async () => {
    const previous = process.env.LOCAL_BUILD
    const previousNodeEnv = process.env.NODE_ENV
    process.env.LOCAL_BUILD = 'true'
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'development', writable: true })
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
        let config: { headers: () => Promise<HeaderRule[]> }
        jest.isolateModules(() => {
            config = require('../../next.config.js')
        })
        rules = await config!.headers()
    } finally {
        log.mockRestore()
        if (previous === undefined) delete process.env.LOCAL_BUILD
        else process.env.LOCAL_BUILD = previous
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previousNodeEnv, writable: true })
    }
})

// Next applies every matching rule in order; a later rule's value wins for the same key.
function headersFor(path: string) {
    const out = new Map<string, string>()
    for (const rule of rules) {
        if (!getPathMatch(rule.source)(path)) continue
        for (const header of rule.headers) out.set(header.key, header.value)
    }
    return out
}

const documents = [
    '/',
    '/qr-payments/brazil',
    '/es-ar',
    '/peanut-card',
    '/press',
    '/es-ar/press',
    '/home',
    '/api/csp-report',
    '/sw.js',
    '/onesignal/OneSignalSDKWorker.js',
]

const assets = [
    '/_next/static/chunks/x.js',
    '/_next/static/css/app.css',
    '/_next/static/media/knerd.0a1b2c.woff2',
    '/_next/image',
    '/flags/br.svg',
    '/press/assets/Peanut_Icon.svg',
    '/favicon.ico',
    '/icons/peanut-icon.svg',
    '/badges/some-badge.png',
    '/llms.txt',
    '/foo/sw.js',
]

describe('next.config headers', () => {
    it.each(documents)('sends both CSP headers on %s', (path) => {
        const headers = headersFor(path)
        expect(headers.get('Content-Security-Policy')).toContain('frame-ancestors')
        expect(headers.get('Content-Security-Policy-Report-Only')?.length).toBeGreaterThan(1000)
        expect(headers.get('Reporting-Endpoints')).toBeDefined()
        expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it.each(assets)('keeps CSP off the static asset %s but keeps the cheap headers', (path) => {
        const headers = headersFor(path)
        expect(headers.has('Content-Security-Policy')).toBe(false)
        expect(headers.has('Content-Security-Policy-Report-Only')).toBe(false)
        expect(headers.has('Reporting-Endpoints')).toBe(false)
        expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(headers.get('Permissions-Policy')).toContain('camera=*')
    })

    it('caches flags and press assets but not the /press page', () => {
        expect(headersFor('/flags/br.svg').get('Cache-Control')).toBe(CACHE)
        expect(headersFor('/press/assets/font/KNERDFilled-Regular.woff2').get('Cache-Control')).toBe(CACHE)
        expect(headersFor('/press').has('Cache-Control')).toBe(false)
        expect(headersFor('/flags').has('Cache-Control')).toBe(false)
        expect(headersFor('/qr-payments/brazil').has('Cache-Control')).toBe(false)
    })

    it('still keeps global policies off the standalone QR routes', () => {
        for (const path of ['/q/home-hero-en', '/api/marketing-qr/open']) {
            const headers = headersFor(path)
            expect([...headers.keys()].some((key) => /content-security-policy|referrer-policy/i.test(key))).toBe(false)
        }
    })

    it('keeps the payment-graph report-only override', () => {
        expect(headersFor('/dev/payment-graph').get('Reporting-Endpoints')).toBe(
            'csp-disabled="/api/csp-report-disabled"'
        )
    })
})
