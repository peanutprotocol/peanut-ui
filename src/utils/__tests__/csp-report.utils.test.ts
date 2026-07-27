import {
    cspReportGroupKey,
    normalizeCspReports,
    sentryCspIngestUrl,
    shouldIgnoreCspReport,
    type CspReport,
} from '../csp-report.utils'

describe('shouldIgnoreCspReport', () => {
    it.each([
        'chrome-extension://abcdefghijklmnop/inject.js',
        'moz-extension://1234-5678/content.js',
        'safari-web-extension://ABCD/script.js',
        'resource://gre/modules/Foo.jsm',
        'about:blank',
    ])('ignores extension/browser-internal blocked-uri %s', (blockedUri) => {
        expect(shouldIgnoreCspReport({ 'blocked-uri': blockedUri })).toBe(true)
    })

    it('ignores a report whose source-file is an extension, even when the blocked-uri looks real', () => {
        expect(
            shouldIgnoreCspReport({
                'blocked-uri': 'https://evil-tracker.example/beacon',
                'source-file': 'chrome-extension://abcdefghijklmnop/inject.js',
            })
        ).toBe(true)
    })

    it('keeps the wss gap that this hotfix closes', () => {
        expect(
            shouldIgnoreCspReport({
                'blocked-uri': 'wss://api.peanut.me',
                'effective-directive': 'connect-src',
            })
        ).toBe(false)
    })

    it.each(['inline', 'eval', 'data', 'blob'])(
        'keeps keyword blocked-uri %s — genuine signal about how loose script-src still is',
        (blockedUri) => {
            expect(shouldIgnoreCspReport({ 'blocked-uri': blockedUri })).toBe(false)
        }
    )

    it('keeps a real third-party host we simply forgot to allow-list', () => {
        expect(shouldIgnoreCspReport({ 'blocked-uri': 'https://arb1.arbitrum.io/rpc' })).toBe(false)
    })

    it('does not treat a missing blocked-uri as noise', () => {
        expect(shouldIgnoreCspReport({})).toBe(false)
    })
})

describe('normalizeCspReports', () => {
    it('reads the legacy report-uri payload', () => {
        expect(
            normalizeCspReports({
                'csp-report': { 'blocked-uri': 'wss://api.peanut.me', 'effective-directive': 'connect-src' },
            })
        ).toEqual([{ 'blocked-uri': 'wss://api.peanut.me', 'effective-directive': 'connect-src' }])
    })

    it('reads a Reporting-API batch and maps it onto the legacy shape', () => {
        const [report] = normalizeCspReports([
            {
                type: 'csp-violation',
                body: {
                    blockedURL: 'wss://api.peanut.me',
                    documentURL: 'https://peanut.me/card',
                    effectiveDirective: 'connect-src',
                    disposition: 'report',
                },
            },
        ])

        expect(report['blocked-uri']).toBe('wss://api.peanut.me')
        expect(report['document-uri']).toBe('https://peanut.me/card')
        expect(report['effective-directive']).toBe('connect-src')
        expect(report['violated-directive']).toBe('connect-src')
    })

    it('drops non-CSP entries from a Reporting-API batch', () => {
        expect(
            normalizeCspReports([
                { type: 'deprecation', body: { id: 'SomeApi' } },
                { type: 'csp-violation', body: { blockedURL: 'inline', effectiveDirective: 'script-src' } },
            ])
        ).toHaveLength(1)
    })

    it.each([null, undefined, 'not json', 42, {}, { 'csp-report': 'nonsense' }])(
        'returns nothing for the malformed payload %p rather than throwing',
        (payload) => {
            expect(normalizeCspReports(payload)).toEqual([])
        }
    )
})

describe('cspReportGroupKey', () => {
    it('collapses different paths on one origin into a single group', () => {
        const a: CspReport = { 'effective-directive': 'connect-src', 'blocked-uri': 'https://arb1.arbitrum.io/rpc' }
        const b: CspReport = { 'effective-directive': 'connect-src', 'blocked-uri': 'https://arb1.arbitrum.io/other' }

        expect(cspReportGroupKey(a)).toBe(cspReportGroupKey(b))
    })

    it('separates different directives on the same origin', () => {
        expect(
            cspReportGroupKey({ 'effective-directive': 'connect-src', 'blocked-uri': 'https://a.example' })
        ).not.toBe(cspReportGroupKey({ 'effective-directive': 'script-src', 'blocked-uri': 'https://a.example' }))
    })

    it('handles keyword blocked-uris that are not URLs', () => {
        expect(cspReportGroupKey({ 'effective-directive': 'script-src', 'blocked-uri': 'inline' })).toBe(
            'script-src|inline'
        )
    })

    it('falls back to violated-directive when the effective one is absent', () => {
        expect(cspReportGroupKey({ 'violated-directive': 'connect-src', 'blocked-uri': 'inline' })).toBe(
            'connect-src|inline'
        )
    })
})

describe('sentryCspIngestUrl', () => {
    it('derives the security endpoint from a browser DSN', () => {
        expect(sentryCspIngestUrl('https://abc123@o1.ingest.us.sentry.io/4505827431415808')).toBe(
            'https://o1.ingest.us.sentry.io/api/4505827431415808/security/?sentry_key=abc123'
        )
    })

    it('preserves a sub-path, as self-hosted Sentry needs', () => {
        expect(sentryCspIngestUrl('https://abc123@sentry.internal/sentry/42')).toBe(
            'https://sentry.internal/sentry/api/42/security/?sentry_key=abc123'
        )
    })

    it.each([undefined, '', 'not-a-dsn', 'https://o1.ingest.sentry.io/123'])(
        'returns null for the unusable DSN %p',
        (dsn) => {
            expect(sentryCspIngestUrl(dsn)).toBeNull()
        }
    )
})
