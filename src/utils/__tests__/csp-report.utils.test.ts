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

    // Sentry's csp:v1 strategy keys these two on the keyword rather than the
    // blocked URI, so it raises two separate issues. If the group key collapsed
    // them, the second would be sampled away as a duplicate and its issue might
    // never be created — in the one category this policy most needs to see.
    it('separates unsafe-inline from unsafe-eval, matching how Sentry groups them', () => {
        const inline = cspReportGroupKey({
            'effective-directive': 'script-src',
            'violated-directive': "script-src 'unsafe-inline'",
            'blocked-uri': 'self',
        })
        const evaluated = cspReportGroupKey({
            'effective-directive': 'script-src',
            'violated-directive': "script-src 'unsafe-eval'",
            'blocked-uri': 'self',
        })

        expect(inline).toBe('script-src|unsafe-inline')
        expect(evaluated).toBe('script-src|unsafe-eval')
        expect(inline).not.toBe(evaluated)
    })

    // What browsers actually emit: the specific sub-directive that was checked.
    // Inline <script> reports as script-src-elem, inline handlers as
    // script-src-attr; only eval stays plain script-src.
    it.each(['script-src-elem', 'script-src-attr'])(
        'applies the keyword grouping to %s, not just the bare script-src',
        (directive) => {
            expect(
                cspReportGroupKey({
                    'effective-directive': directive,
                    'violated-directive': `${directive} 'unsafe-inline'`,
                    'blocked-uri': 'self',
                })
            ).toBe(`${directive}|unsafe-inline`)
        }
    )

    it('leaves a normal script-src host violation keyed on its origin', () => {
        expect(
            cspReportGroupKey({
                'effective-directive': 'script-src',
                'violated-directive': 'script-src',
                'blocked-uri': 'https://cdn.example/x.js',
            })
        ).toBe('script-src|https://cdn.example')
    })

    // The regression that matters most. Our own script-src contains
    // 'unsafe-inline' and 'unsafe-eval', and Firefox/Safari echo the entire
    // source list back in violated-directive. Keying on the keyword without
    // checking that the violation was local collapsed every blocked
    // third-party script into the ubiquitous inline group, where the 1%
    // duplicate sampling would bury it — the exact issue-loss the grouping
    // exists to prevent.
    it('keys a blocked third-party script on its origin even when the policy text names unsafe-inline', () => {
        const realPolicy = "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"

        const blockedCdn = cspReportGroupKey({
            'effective-directive': 'script-src-elem',
            'violated-directive': realPolicy,
            'blocked-uri': 'https://cdn.attacker.example/x.js',
        })
        const ourInlineBootstrap = cspReportGroupKey({
            'effective-directive': 'script-src-elem',
            'violated-directive': realPolicy,
            'blocked-uri': 'self',
        })

        expect(blockedCdn).toBe('script-src-elem|https://cdn.attacker.example')
        expect(blockedCdn).not.toBe(ourInlineBootstrap)
    })

    // Firefox omits effective-directive and sends the full source list, so an
    // un-normalized key would embed the whole policy and reset on every edit.
    it('normalizes a full Firefox violated-directive down to the bare directive', () => {
        expect(
            cspReportGroupKey({
                'violated-directive': "connect-src 'self' https://api.peanut.me https://*.peanut.me",
                'blocked-uri': 'wss://api.peanut.me/charges',
            })
        ).toBe('connect-src|wss://api.peanut.me')
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
