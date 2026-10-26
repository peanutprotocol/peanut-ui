import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }
const qrPaths = ['/q', '/q/home-hero-en', '/api/marketing-qr/open', '/api/marketing-qr/open/']
const normalPaths = ['/', '/app', '/qr/payment-code', '/qrcode', '/api/marketing-qr/opening']

function headersFor(rules: HeaderRule[], path: string) {
    return rules.filter((rule) => getPathMatch(rule.source)(path)).flatMap((rule) => rule.headers)
}

it('keeps Next global policies from replacing standalone QR response policies', async () => {
    const previous = process.env.LOCAL_BUILD
    const previousNodeEnv = process.env.NODE_ENV
    process.env.LOCAL_BUILD = 'true'
    Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'development', writable: true })
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    let config: { headers: () => Promise<HeaderRule[]> }
    try {
        jest.isolateModules(() => {
            config = require('../../../../next.config.js')
        })
        const rules = await config!.headers()
        for (const path of qrPaths) {
            const headers = headersFor(rules, path)
            expect(headers).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' })
            expect(
                headers.some((header) =>
                    /content-security-policy|referrer-policy|reporting-endpoints/i.test(header.key)
                )
            ).toBe(false)
        }
        for (const path of normalPaths) {
            expect(headersFor(rules, path)).toContainEqual({
                key: 'Referrer-Policy',
                value: 'strict-origin-when-cross-origin',
            })
        }
    } finally {
        log.mockRestore()
        if (previous === undefined) delete process.env.LOCAL_BUILD
        else process.env.LOCAL_BUILD = previous
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previousNodeEnv, writable: true })
    }
})

it('also preserves QR policies behind Vercel while retaining transport security', () => {
    const config = require('../../../../vercel.json') as { headers: HeaderRule[] }
    for (const path of qrPaths) {
        const headers = headersFor(config.headers, path)
        expect(headers.some((header) => /content-security-policy|referrer-policy/i.test(header.key))).toBe(false)
        expect(headers).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' })
        expect(headers).toContainEqual({
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
        })
    }
    for (const path of normalPaths) {
        expect(headersFor(config.headers, path)).toContainEqual({
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
        })
    }
})
