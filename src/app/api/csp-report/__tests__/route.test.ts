/** @jest-environment node */
import type { NextRequest } from 'next/server'
import type { CspReport } from '@/utils/csp-report.utils'

// The selection loop's own invariants (the per-request cap, intra-batch
// de-duplication, the ignore filter) are pinned against selectReportsToForward
// in src/utils/__tests__/csp-report.utils.test.ts. This file covers what only
// the route holds: the always-204 contract, content-type gating, DSN
// derivation, the pass-through headers, and the cross-request `seenGroups`
// state — sampling, eviction, and the fact that a group the cap turned away is
// not recorded as seen.

const DSN = 'https://publickey@o1.ingest.sentry.io/4505'
const INGEST_URL = 'https://o1.ingest.sentry.io/api/4505/security/?sentry_key=publickey'

type RouteModule = typeof import('../route')
let route: RouteModule

// seenGroups is module-level and deliberately outlives a request, so each test
// needs its own copy of the module.
function loadRoute(): void {
    jest.isolateModules(() => {
        // isolateModules is sync-only, so this has to be require() rather than import
        route = require('../route')
    })
}

let fetchMock: jest.Mock
let randomSpy: jest.SpyInstance<number, []>
const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

beforeEach(() => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = DSN
    fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    // Never sample a duplicate unless a test says otherwise, so "was forwarded"
    // means "was a first sighting" and no assertion here depends on chance.
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99)
    loadRoute()
})

afterEach(() => {
    jest.restoreAllMocks()
    process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn
})

function makeRequest(
    body: unknown,
    { contentType = 'application/csp-report', headers = {} }: { contentType?: string; headers?: HeadersInit } = {}
): NextRequest {
    const requestHeaders = new Headers(headers)
    if (contentType) requestHeaders.set('content-type', contentType)
    return { headers: requestHeaders, json: async () => body } as unknown as NextRequest
}

const report = (blockedUri: string, directive = 'connect-src'): CspReport => ({
    'blocked-uri': blockedUri,
    'document-uri': 'https://peanut.me/home',
    'effective-directive': directive,
    'violated-directive': directive,
})

const reportingApiEntry = (report: CspReport) => ({
    type: 'csp-violation',
    body: {
        blockedURL: report['blocked-uri'],
        documentURL: report['document-uri'],
        effectiveDirective: report['effective-directive'],
    },
})

/** One legacy `report-uri` POST — what Firefox and Safari still send. */
const post = (report: CspReport) => route.POST(makeRequest({ 'csp-report': report }))

/** One Reporting-API (`report-to`) batch. */
const postBatch = (...reports: CspReport[]) =>
    route.POST(makeRequest(reports.map(reportingApiEntry), { contentType: 'application/reports+json' }))

const forwardedUris = (): unknown[] =>
    fetchMock.mock.calls.map((call) => JSON.parse(call[1].body)['csp-report']['blocked-uri'])

describe('POST /api/csp-report — response contract', () => {
    it.each([
        ['a forwarded report', { 'csp-report': report('https://cdn.example/x.js') }],
        ['an empty batch', []],
        ['an unrecognised payload', { hello: 'world' }],
    ])('answers 204 with no body for %s', async (_case, body) => {
        const response = await route.POST(makeRequest(body))

        expect(response.status).toBe(204)
        expect(response.body).toBeNull()
    })

    it('answers 204 when the body is not JSON at all', async () => {
        const request = {
            headers: new Headers({ 'content-type': 'application/csp-report' }),
            json: async () => {
                throw new SyntaxError('Unexpected token < in JSON')
            },
        } as unknown as NextRequest

        const response = await route.POST(request)

        expect(response.status).toBe(204)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    // A non-2xx makes the browser retry and log a console error, which would be
    // a second, self-inflicted noise source.
    it('answers 204 when the forward to Sentry fails', async () => {
        fetchMock.mockRejectedValue(new Error('sentry unreachable'))

        const response = await post(report('https://cdn.example/x.js'))

        expect(response.status).toBe(204)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

describe('POST /api/csp-report — content-type gating', () => {
    it.each([
        'application/csp-report',
        'application/reports+json',
        'application/json',
        'application/csp-report; charset=utf-8',
        'Application/CSP-Report',
        '  application/json  ',
    ])('accepts %p', async (contentType) => {
        await route.POST(makeRequest({ 'csp-report': report('https://cdn.example/x.js') }, { contentType }))

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', ''])(
        'drops %p without reading the body',
        async (contentType) => {
            const json = jest.fn()
            const request = {
                headers: contentType ? new Headers({ 'content-type': contentType }) : new Headers(),
                json,
            } as unknown as NextRequest

            const response = await route.POST(request)

            expect(response.status).toBe(204)
            expect(json).not.toHaveBeenCalled()
            expect(fetchMock).not.toHaveBeenCalled()
        }
    )
})

describe('POST /api/csp-report — Sentry ingest target', () => {
    it.each([
        ['is missing', undefined],
        ['is malformed', 'not-a-dsn'],
    ])('forwards nothing when the DSN %s', async (_case, dsn) => {
        if (dsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN
        else process.env.NEXT_PUBLIC_SENTRY_DSN = dsn

        const response = await post(report('https://cdn.example/x.js'))

        expect(response.status).toBe(204)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('posts the report to the DSN-derived security endpoint in the legacy shape', async () => {
        const violation = report('wss://api.peanut.me/charges')

        await post(violation)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe(INGEST_URL)
        expect(init.method).toBe('POST')
        expect(init.headers['Content-Type']).toBe('application/csp-report')
        expect(JSON.parse(init.body)).toEqual({ 'csp-report': violation })
        expect(init.signal).toBeInstanceOf(AbortSignal)
    })

    // Sentry reads the browser and user dimensions off whoever POSTs to it,
    // which is now us rather than the browser.
    it('passes the reporting browser through instead of attributing every event to Vercel', async () => {
        await route.POST(
            makeRequest(
                { 'csp-report': report('https://cdn.example/x.js') },
                { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)', 'x-forwarded-for': '203.0.113.7' } }
            )
        )

        const { headers } = fetchMock.mock.calls[0][1]
        expect(headers['User-Agent']).toBe('Mozilla/5.0 (iPhone)')
        expect(headers['X-Forwarded-For']).toBe('203.0.113.7')
    })

    it('omits the pass-through headers rather than forwarding empty ones', async () => {
        await post(report('https://cdn.example/x.js'))

        expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/csp-report' })
    })

    it('normalises a Reporting-API batch into the legacy shape Sentry ingests', async () => {
        await postBatch(report('https://cdn.example/x.js', 'script-src-elem'))

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)['csp-report']).toEqual(
            expect.objectContaining({
                'blocked-uri': 'https://cdn.example/x.js',
                'effective-directive': 'script-src-elem',
                'violated-directive': 'script-src-elem',
            })
        )
    })
})

describe('POST /api/csp-report — de-duplication across requests', () => {
    it('forwards the first sighting of each group and drops the repeats', async () => {
        await post(report('https://cdn.example/x.js'))
        await post(report('https://cdn.example/other.js')) // same origin + directive → same group
        await post(report('https://other-cdn.example/y.js'))

        expect(forwardedUris()).toEqual(['https://cdn.example/x.js', 'https://other-cdn.example/y.js'])
    })

    it('lets 1% of the repeats through so a still-firing violation keeps a heartbeat', async () => {
        await post(report('https://cdn.example/x.js'))
        fetchMock.mockClear()

        randomSpy.mockReturnValue(0.005)
        await post(report('https://cdn.example/x.js'))

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    // Sentry raises two issues for these, so grouping them as one would sample
    // whichever arrived second away — in the directive that matters most.
    it('keeps the unsafe-inline and unsafe-eval script-src groups apart', async () => {
        const local = (keyword: string): CspReport => ({
            'blocked-uri': 'self',
            'effective-directive': 'script-src-elem',
            'violated-directive': `script-src-elem 'self' '${keyword}'`,
        })

        await post(local('unsafe-inline'))
        await post(local('unsafe-eval'))

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('never forwards a violation an extension caused, whatever its batch position', async () => {
        await postBatch(report('chrome-extension://abcdefghijklmnop/inject.js'), report('https://cdn.example/x.js'))

        expect(forwardedUris()).toEqual(['https://cdn.example/x.js'])
    })
})

describe('POST /api/csp-report — per-request fan-out cap', () => {
    const distinct = (count: number, offset = 0) =>
        Array.from({ length: count }, (_, index) => report(`https://cdn-${index + offset}.example/x.js`))

    it('forwards at most 20 reports however large the batch', async () => {
        await postBatch(...distinct(50))

        expect(fetchMock).toHaveBeenCalledTimes(20)
    })

    // The cap counts distinct groups, so the repeats a real batch is dominated
    // by cannot crowd out a genuinely new violation.
    it('spends the cap on distinct groups, not on repeats', async () => {
        const repeated = report('https://cdn.example/x.js')

        await postBatch(...Array.from({ length: 30 }, () => repeated), report('https://other-cdn.example/y.js'))

        expect(forwardedUris()).toEqual(['https://cdn.example/x.js', 'https://other-cdn.example/y.js'])
    })

    // The regression this ordering exists for: a group the cap turned away must
    // NOT be recorded as seen, or its real first sighting is lost and every
    // later repeat is sampled away at 1%.
    it('does not burn the first sighting of a group the cap turned away', async () => {
        await postBatch(...distinct(25))
        expect(fetchMock).toHaveBeenCalledTimes(20)
        fetchMock.mockClear()

        await post(report('https://cdn-24.example/x.js'))

        expect(forwardedUris()).toEqual(['https://cdn-24.example/x.js'])
    })

    it('bounds the memory by evicting the oldest group, not by forgetting all of them', async () => {
        // SEEN_GROUPS_MAX is 500 and one request admits at most 20 groups.
        for (let batch = 0; batch < 25; batch++) await postBatch(...distinct(20, batch * 20))
        expect(fetchMock).toHaveBeenCalledTimes(500)

        await post(report('https://overflow.example/x.js'))
        fetchMock.mockClear()

        // Room for the 501st group came from dropping one stale group, not from
        // dumping all 500 and letting every still-active violation re-forward.
        await post(report('https://cdn-499.example/x.js'))
        expect(fetchMock).not.toHaveBeenCalled()

        // The evicted group is the oldest, which reads as new again.
        await post(report('https://cdn-0.example/x.js'))
        expect(forwardedUris()).toEqual(['https://cdn-0.example/x.js'])
    })
})
