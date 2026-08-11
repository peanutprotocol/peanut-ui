import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    INDEXNOW_ENDPOINT,
    MAX_URLS_PER_REQUEST,
    PRODUCTION_ORIGIN,
    ROOT_SITEMAP_URL,
    SPLIT_SITEMAP_URL,
    assertSplitPageIndexable,
    collectDeployedUrls,
    fetchSitemapUrls,
    hasNoindexDirective,
    parseSitemapXml,
    readValidatedState,
    runIndexNow,
    validatePublicUrl,
    writeStateAtomic,
    type IndexNowLogger,
    type IndexNowOptions,
} from '../indexnow'

const TEST_KEY = 'test-indexnow-key-1234'
const HOME = PRODUCTION_ORIGIN
const NEW_ROOT_URL = `${PRODUCTION_ORIGIN}/en/new-page`
const OLD_SPLIT_URL = `${PRODUCTION_ORIGIN}/en/split/guides/retired-guide`
const LOCATIONS = ['en', 'es-419', 'pt-br'] as const
const SLUGS = ['split-a-group-trip-across-countries', 'split-expenses-across-currencies'] as const
const SIX_SPLIT_URLS = SLUGS.flatMap((slug) =>
    LOCATIONS.map((locale) => `${PRODUCTION_ORIGIN}/${locale}/split/guides/${slug}`)
)

interface ResponseSpec {
    status?: number
    body?: string
    contentType?: string
    headers?: Record<string, string>
    url?: string
    redirected?: boolean
}

type RouteSpec = ResponseSpec | Error
type ApiSpec = ResponseSpec | Error

function xmlEscape(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function sitemapXml(urls: string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}
</urlset>`
}

function response(requestedUrl: string, spec: ResponseSpec = {}): Response {
    const headers = new Map<string, string>()
    if (spec.contentType) headers.set('content-type', spec.contentType)
    for (const [name, value] of Object.entries(spec.headers ?? {})) headers.set(name.toLowerCase(), value)
    return {
        status: spec.status ?? 200,
        statusText: '',
        redirected: spec.redirected ?? false,
        url: spec.url ?? requestedUrl,
        headers: {
            get(name: string) {
                return headers.get(name.toLowerCase()) ?? null
            },
        },
        text: async () => spec.body ?? '',
    } as unknown as Response
}

function createFetch(routes: Map<string, RouteSpec>, apiResponses: ApiSpec[] = []) {
    const apiQueue = [...apiResponses]
    const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input)
        if (url === INDEXNOW_ENDPOINT && init?.method === 'POST') {
            const spec = apiQueue.shift() ?? { status: 200 }
            if (spec instanceof Error) throw spec
            return response(url, spec)
        }
        const spec = routes.get(url)
        if (!spec) throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
        if (spec instanceof Error) throw spec
        return response(url, spec)
    })
    return { fetchImpl: mock as unknown as typeof fetch, mock }
}

function deployedRoutes(rootUrls: string[], split: ResponseSpec | string[] = []): Map<string, RouteSpec> {
    return new Map<string, RouteSpec>([
        [ROOT_SITEMAP_URL, { status: 200, contentType: 'application/xml; charset=utf-8', body: sitemapXml(rootUrls) }],
        [
            SPLIT_SITEMAP_URL,
            Array.isArray(split) ? { status: 200, contentType: 'application/xml', body: sitemapXml(split) } : split,
        ],
    ])
}

function addIndexablePages(routes: Map<string, RouteSpec>, urls: string[]): void {
    for (const url of urls)
        routes.set(url, { status: 200, contentType: 'text/html', body: '<html><head></head></html>' })
}

const logger: IndexNowLogger = {
    log: jest.fn(),
    error: jest.fn(),
}

let temporaryDirectories: string[] = []

function statePath(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'peanut-indexnow-test-'))
    temporaryDirectories.push(directory)
    return path.join(directory, 'state', 'urls.json')
}

function baseOptions(
    fetchImpl: typeof fetch,
    stateFile: string,
    overrides: Partial<IndexNowOptions> = {}
): IndexNowOptions {
    return {
        fetchImpl,
        stateFile,
        key: TEST_KEY,
        indexReleased: false,
        dryRun: false,
        bootstrap: false,
        full: false,
        timeoutMs: 1_000,
        logger,
        now: () => new Date('2026-08-11T18:00:00.000Z'),
        ...overrides,
    }
}

function apiCalls(mock: jest.Mock): Array<[RequestInfo | URL, RequestInit | undefined]> {
    return mock.mock.calls.filter(([, init]) => init?.method === 'POST')
}

afterEach(() => {
    jest.clearAllMocks()
    for (const directory of temporaryDirectories) fs.rmSync(directory, { recursive: true, force: true })
    temporaryDirectories = []
})

describe('strict deployed sitemap parsing', () => {
    test('parses the standard namespace and decodes XML entities', () => {
        const url = `${PRODUCTION_ORIGIN}/en/page?one=1&two=2`
        expect(parseSitemapXml(sitemapXml([url]), ROOT_SITEMAP_URL)).toEqual([url])
    })

    test('allows a valid empty urlset for the optional Split sitemap', () => {
        expect(parseSitemapXml(sitemapXml([]), SPLIT_SITEMAP_URL)).toEqual([])
    })

    test.each([
        ['DTD', `<!DOCTYPE urlset><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`],
        [
            'entity declaration',
            `<!DOCTYPE urlset [<!ENTITY x "boom">]><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`,
        ],
        ['malformed XML', `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url>`],
        ['sitemap index root', `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>`],
        ['missing loc', `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url></url></urlset>`],
        [
            'markup in loc',
            `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc><b>${HOME}</b></loc></url></urlset>`,
        ],
    ])('rejects %s', (_label, document) => {
        expect(() => parseSitemapXml(document, ROOT_SITEMAP_URL)).toThrow()
    })

    test.each([
        'http://peanut.me/en/page',
        'https://evil.example/en/page',
        'https://user:pass@peanut.me/en/page',
        'https://peanut.me/en/page#fragment',
        'https://peanut.me/en/%ZZ',
        ' https://peanut.me/en/page',
        'https://peanut.me/a page',
    ])('rejects malformed or non-owned location %s', (url) => {
        expect(() => validatePublicUrl(url)).toThrow()
    })

    test.each([204, 404, 410])('treats optional status %s as absent', async (status) => {
        const { fetchImpl } = createFetch(new Map([[SPLIT_SITEMAP_URL, { status }]]))
        await expect(
            fetchSitemapUrls({ fetchImpl, url: SPLIT_SITEMAP_URL, optional: true, timeoutMs: 1_000 })
        ).resolves.toEqual([])
    })

    test('rejects an empty required root sitemap', async () => {
        const { fetchImpl } = createFetch(
            new Map([[ROOT_SITEMAP_URL, { status: 200, contentType: 'application/xml', body: sitemapXml([]) }]])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow('must not be empty')
    })

    test.each([
        ['HTML catch-all', { status: 200, contentType: 'text/html', body: '<!doctype html>' }],
        ['malformed XML', { status: 200, contentType: 'application/xml', body: '<urlset>' }],
        ['redirect', { status: 302, contentType: 'text/html', body: '' }],
        [
            'cross-origin response URL',
            { status: 200, contentType: 'application/xml', body: sitemapXml([]), url: 'https://evil.example/map.xml' },
        ],
        ['server error', { status: 503, contentType: 'application/xml', body: '' }],
    ] satisfies Array<[string, ResponseSpec]>)(
        'rejects optional %s instead of treating it as missing',
        async (_label, spec) => {
            const { fetchImpl } = createFetch(new Map([[SPLIT_SITEMAP_URL, spec]]))
            await expect(
                fetchSitemapUrls({ fetchImpl, url: SPLIT_SITEMAP_URL, optional: true, timeoutMs: 1_000 })
            ).rejects.toThrow()
        }
    )

    test('deduplicates root and Split URLs while preserving deployed order', async () => {
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, split], [split, split])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).resolves.toEqual({
            rootUrls: [HOME, split],
            splitSitemapUrls: [split],
            splitUrls: [split],
            allUrls: [HOME, split],
        })
    })

    test('rejects a non-Split URL emitted by the Split sitemap', async () => {
        const routes = deployedRoutes([HOME], [NEW_ROOT_URL])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).rejects.toThrow(
            'outside the owned Split namespace'
        )
    })
})

describe('validated and atomic state', () => {
    test('returns null only for a missing state file', () => {
        expect(readValidatedState(statePath())).toBeNull()
    })

    test.each([
        ['invalid JSON', '{'],
        ['wrong schema', JSON.stringify({ version: 2, urls: [] })],
        [
            'foreign URL',
            JSON.stringify({
                version: 1,
                urls: ['https://evil.example/page'],
                writtenAt: '2026-08-11T18:00:00.000Z',
                reason: 'bootstrap',
            }),
        ],
        [
            'duplicate URL',
            JSON.stringify({
                version: 1,
                urls: [HOME, `${HOME}/`],
                writtenAt: '2026-08-11T18:00:00.000Z',
                reason: 'bootstrap',
            }),
        ],
    ])('rejects %s cache state', (_label, contents) => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, contents)
        expect(() => readValidatedState(file)).toThrow('Invalid IndexNow state')
    })

    test('explicit root-only bootstrap writes one complete state file and calls no API', async () => {
        const file = statePath()
        const routes = deployedRoutes([HOME, NEW_ROOT_URL])
        const { fetchImpl, mock } = createFetch(routes)
        const result = await runIndexNow(baseOptions(fetchImpl, file, { bootstrap: true }))

        expect(result.mode).toBe('bootstrap')
        expect(readValidatedState(file)).toMatchObject({
            urls: [HOME, NEW_ROOT_URL],
            reason: 'bootstrap',
        })
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readdirSync(path.dirname(file))).toEqual(['urls.json'])
    })

    test('bootstrap refuses to absorb a non-empty Split sitemap', async () => {
        const file = statePath()
        const routes = deployedRoutes([HOME], [SIX_SPLIT_URLS[0]])
        const { fetchImpl, mock } = createFetch(routes)
        await expect(runIndexNow(baseOptions(fetchImpl, file, { bootstrap: true }))).rejects.toThrow(
            'only while the deployed Split sitemap is empty'
        )
        expect(fs.existsSync(file)).toBe(false)
        expect(apiCalls(mock)).toHaveLength(0)
    })

    test('bootstrap refuses to replace an existing validated baseline', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const { fetchImpl, mock } = createFetch(deployedRoutes([HOME, NEW_ROOT_URL]))

        await expect(runIndexNow(baseOptions(fetchImpl, file, { bootstrap: true }))).rejects.toThrow(
            'refusing to replace an existing baseline'
        )
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('bootstrap cannot be disguised as a dry-run', async () => {
        const file = statePath()
        const { fetchImpl, mock } = createFetch(deployedRoutes([HOME]))
        await expect(runIndexNow(baseOptions(fetchImpl, file, { bootstrap: true, dryRun: true }))).rejects.toThrow(
            'cannot be combined'
        )
        expect(mock).not.toHaveBeenCalled()
        expect(fs.existsSync(file)).toBe(false)
    })

    test('a missing state never causes an automatic full submission', async () => {
        const file = statePath()
        const { fetchImpl, mock } = createFetch(deployedRoutes([HOME, NEW_ROOT_URL]))
        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result.mode).toBe('gate-closed')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.existsSync(file)).toBe(false)
    })

    test('explicit full dry-run can inspect a missing baseline without writing it', async () => {
        const file = statePath()
        const { fetchImpl, mock } = createFetch(deployedRoutes([HOME, NEW_ROOT_URL]))
        const result = await runIndexNow(baseOptions(fetchImpl, file, { full: true, dryRun: true }))
        expect(result).toMatchObject({ mode: 'dry-run', candidates: [HOME, NEW_ROOT_URL] })
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.existsSync(file)).toBe(false)
    })
})

describe('release, noindex, and delta gates', () => {
    test('closed release gate withholds a valid Split delta without page/API fetches or state mutation', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME], [SIX_SPLIT_URLS[0]])
        const { fetchImpl, mock } = createFetch(routes)

        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result).toMatchObject({ mode: 'gate-closed', candidates: [SIX_SPLIT_URLS[0]] })
        expect(mock).toHaveBeenCalledTimes(2)
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('computes additions then deletions in stable deployed/state order', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME, OLD_SPLIT_URL], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL])
        const { fetchImpl, mock } = createFetch(routes)

        const result = await runIndexNow(baseOptions(fetchImpl, file, { dryRun: true }))
        expect(result).toMatchObject({
            mode: 'dry-run',
            added: [NEW_ROOT_URL],
            deleted: [OLD_SPLIT_URL],
            candidates: [NEW_ROOT_URL, OLD_SPLIT_URL],
        })
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('dry-run exposes exactly the six indexable B4 canary URLs and mutates nothing', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME], SIX_SPLIT_URLS)
        addIndexablePages(routes, SIX_SPLIT_URLS)
        const { fetchImpl, mock } = createFetch(routes)

        const result = await runIndexNow(baseOptions(fetchImpl, file, { dryRun: true }))
        expect(result.mode).toBe('dry-run')
        expect(result.added).toEqual(SIX_SPLIT_URLS)
        expect(result.deleted).toEqual([])
        expect(result.candidates).toEqual(SIX_SPLIT_URLS)
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test.each([
        [
            'X-Robots-Tag',
            {
                status: 200,
                contentType: 'text/html',
                headers: { 'x-robots-tag': 'noindex, nofollow' },
                body: '<html></html>',
            },
        ],
        [
            'robots meta',
            {
                status: 200,
                contentType: 'text/html',
                body: '<html><head><meta content="follow, NOINDEX" name="robots"></head></html>',
            },
        ],
        [
            'Bing meta',
            {
                status: 200,
                contentType: 'text/html',
                body: "<html><head><meta name='bingbot' content='noindex'></head></html>",
            },
        ],
    ] satisfies Array<[string, ResponseSpec]>)('refuses a Split page carrying %s noindex', async (_label, page) => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME], [split])
        routes.set(split, page)
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))).rejects.toThrow(
            'still noindex'
        )
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test.each([
        ['redirect', { status: 302, contentType: 'text/html', body: '' }],
        ['not found', { status: 404, contentType: 'text/html', body: '' }],
        ['non-HTML', { status: 200, contentType: 'application/json', body: '{}' }],
        [
            'cross-origin final URL',
            { status: 200, contentType: 'text/html', body: '<html></html>', url: 'https://evil.example/page' },
        ],
    ] satisfies Array<[string, ResponseSpec]>)('refuses a Split page with %s response', async (_label, page) => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME], [split])
        routes.set(split, page)
        const { fetchImpl, mock } = createFetch(routes)

        await expect(runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))).rejects.toThrow()
        expect(apiCalls(mock)).toHaveLength(0)
    })

    test('recognizes header and reordered/meta quoting noindex forms', () => {
        expect(hasNoindexDirective('<html></html>', 'max-snippet:20; noindex')).toBe(true)
        expect(hasNoindexDirective('<META CONTENT=noindex NAME=robots>', null)).toBe(true)
        expect(hasNoindexDirective('<meta name="robots" content="none">', null)).toBe(true)
        expect(hasNoindexDirective('<html></html>', 'bingbot: none')).toBe(true)
        expect(hasNoindexDirective('<meta name="robots" content="index,follow">', null)).toBe(false)
    })

    test('direct indexability check accepts a clean direct HTML page', async () => {
        const split = SIX_SPLIT_URLS[0]
        const { fetchImpl } = createFetch(
            new Map([[split, { status: 200, contentType: 'text/html; charset=utf-8', body: '<html></html>' }]])
        )
        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).resolves.toBeUndefined()
    })
})

describe('IndexNow payload, batching, errors, and state advancement', () => {
    test.each([200, 202])('accepts exact protocol success status %s and advances state atomically', async (status) => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL])
        const { fetchImpl, mock } = createFetch(routes, [{ status }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))
        expect(result).toMatchObject({ mode: 'submitted', candidates: [NEW_ROOT_URL], batches: 1 })
        expect(readValidatedState(file)).toMatchObject({ urls: [HOME, NEW_ROOT_URL], reason: 'submission' })

        const [, request] = apiCalls(mock)[0]
        expect(request?.headers).toEqual({ 'Content-Type': 'application/json; charset=utf-8' })
        expect(JSON.parse(String(request?.body))).toEqual({
            host: 'peanut.me',
            key: TEST_KEY,
            keyLocation: `${PRODUCTION_ORIGIN}/${TEST_KEY}.txt`,
            urlList: [NEW_ROOT_URL],
        })
    })

    test.each([204, 301, 400, 403, 422, 429, 500])(
        'rejects protocol status %s and leaves the previous state byte-identical',
        async (status) => {
            const file = statePath()
            writeStateAtomic(file, [HOME], 'bootstrap')
            const before = fs.readFileSync(file, 'utf8')
            const { fetchImpl } = createFetch(deployedRoutes([HOME, NEW_ROOT_URL]), [
                { status, body: `status-${status}` },
            ])

            await expect(runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))).rejects.toThrow(
                'state was not advanced'
            )
            expect(fs.readFileSync(file, 'utf8')).toBe(before)
        }
    )

    test('uses stable batches of 10,000 and then one URL', async () => {
        const file = statePath()
        writeStateAtomic(file, [], 'bootstrap')
        const urls = Array.from(
            { length: MAX_URLS_PER_REQUEST + 1 },
            (_, index) => `${PRODUCTION_ORIGIN}/en/batch-${String(index).padStart(5, '0')}`
        )
        const { fetchImpl, mock } = createFetch(deployedRoutes(urls), [{ status: 200 }, { status: 202 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))
        expect(result).toMatchObject({ mode: 'submitted', batches: 2 })
        const calls = apiCalls(mock)
        expect(calls).toHaveLength(2)
        expect(JSON.parse(String(calls[0][1]?.body)).urlList).toEqual(urls.slice(0, MAX_URLS_PER_REQUEST))
        expect(JSON.parse(String(calls[1][1]?.body)).urlList).toEqual(urls.slice(MAX_URLS_PER_REQUEST))
        expect(readValidatedState(file)?.urls).toEqual(urls)
    })

    test('continues later batches after a transport failure and advances no state', async () => {
        const file = statePath()
        writeStateAtomic(file, [], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const urls = Array.from(
            { length: MAX_URLS_PER_REQUEST + 1 },
            (_, index) => `${PRODUCTION_ORIGIN}/en/transport-${String(index).padStart(5, '0')}`
        )
        const { fetchImpl, mock } = createFetch(deployedRoutes(urls), [new Error('network down'), { status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))).rejects.toThrow(
            'state was not advanced'
        )
        expect(apiCalls(mock)).toHaveLength(2)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('submits a disappeared Split URL as a deletion without demanding a live page', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME, OLD_SPLIT_URL], 'submission')
        const routes = deployedRoutes([HOME])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { indexReleased: true }))
        expect(result).toMatchObject({ deleted: [OLD_SPLIT_URL], candidates: [OLD_SPLIT_URL] })
        expect(mock).toHaveBeenCalledTimes(3)
        expect(JSON.parse(String(apiCalls(mock)[0][1]?.body)).urlList).toEqual([OLD_SPLIT_URL])
        expect(readValidatedState(file)?.urls).toEqual([HOME])
    })

    test('dry-run never calls the API or changes an existing state file', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const { fetchImpl, mock } = createFetch(deployedRoutes([HOME, NEW_ROOT_URL]), [{ status: 200 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { dryRun: true }))
        expect(result.mode).toBe('dry-run')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })
})

describe('workflow fail-closed contract', () => {
    test('pins Node 20 and commits the release gate closed with dry-run default on', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')
        expect(workflow).toContain("node-version: '20'")
        expect(workflow).not.toContain('node-version-file:')
        expect(workflow).toContain("INDEXNOW_INDEX_RELEASED: 'false'")
        expect(workflow).not.toContain("INDEXNOW_INDEX_RELEASED: 'true'")
        expect(workflow).toMatch(/dry_run:[\s\S]*?default: true/)
        expect(workflow).toMatch(/bootstrap:[\s\S]*?default: false/)
        expect(workflow).toMatch(/full:[\s\S]*?default: false/)
        expect(workflow).toContain("hashFiles('.indexnow-state/urls.json') != ''")

        const productionKey = workflow.match(/INDEXNOW_KEY: '([A-Za-z0-9-]+)'/)?.[1]
        expect(productionKey).toBeDefined()
        expect(fs.readFileSync(path.join(process.cwd(), 'public', `${productionKey}.txt`), 'utf8')).toBe(productionKey)
    })
})
