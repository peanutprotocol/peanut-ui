describe('payment explorer document headers', () => {
    it('prevents caches, referrers, and indexing on the sensitive route', async () => {
        const previous = process.env.LOCAL_BUILD
        const previousNodeEnv = process.env.NODE_ENV
        process.env.LOCAL_BUILD = 'true'
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'development', writable: true })
        type HeaderConfig = {
            headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>
        }
        let exported: HeaderConfig
        const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
        jest.isolateModules(() => {
            exported = require('../../../../next.config.js')
        })
        if (previous === undefined) delete process.env.LOCAL_BUILD
        else process.env.LOCAL_BUILD = previous
        Object.defineProperty(process.env, 'NODE_ENV', {
            configurable: true,
            value: previousNodeEnv,
            writable: true,
        })

        const rules = await exported!.headers()
        const route = rules.find((rule) => rule.source === '/dev/payment-graph')
        expect(route?.headers).toEqual(
            expect.arrayContaining([
                { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
                { key: 'Pragma', value: 'no-cache' },
                { key: 'Referrer-Policy', value: 'no-referrer' },
                { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
            ])
        )
        const reportOnly = route?.headers.find((header) => header.key === 'Content-Security-Policy-Report-Only')
        const reportingEndpoints = route?.headers.find((header) => header.key === 'Reporting-Endpoints')
        expect(reportOnly?.value).not.toContain('report-uri')
        expect(reportOnly?.value).not.toContain('report-to')
        expect(reportingEndpoints?.value).toBe('csp-disabled="/api/csp-report-disabled"')
        expect(reportingEndpoints?.value ?? '').not.toMatch(/\/api\/csp-report(?=$|["'\s,])/)
        consoleLog.mockRestore()
    })

    it('overrides the Vercel-wide referrer policy for the exact route and its trailing-slash family', () => {
        type VercelHeaderRule = {
            source: string
            headers: Array<{ key: string; value: string }>
        }
        const config = require('../../../../vercel.json') as { headers: VercelHeaderRule[] }
        const broadRuleIndex = config.headers.findIndex((rule) => rule.source === '/(.*)')
        const explorerSources = ['/dev/payment-graph', '/dev/payment-graph/(.*)']

        expect(broadRuleIndex).toBeGreaterThanOrEqual(0)
        for (const source of explorerSources) {
            const index = config.headers.findIndex((rule) => rule.source === source)
            expect(index).toBeGreaterThan(broadRuleIndex)
            expect(config.headers[index]?.headers).toContainEqual({
                key: 'Referrer-Policy',
                value: 'no-referrer',
            })
        }

        expect(new RegExp('^/dev/payment-graph$').test('/dev/payment-graph')).toBe(true)
        expect(new RegExp('^/dev/payment-graph/(.*)$').test('/dev/payment-graph/')).toBe(true)
        expect(new RegExp('^/dev/payment-graph/(.*)$').test('/dev/payment-graph/child')).toBe(true)
        expect(new RegExp('^/dev/payment-graph$').test('/dev/payment-graphic')).toBe(false)
    })
})
