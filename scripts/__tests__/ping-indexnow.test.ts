import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ReadableStream } from 'node:stream/web'
import {
    INDEXNOW_ENDPOINT,
    MAX_STATE_BYTES,
    MAX_STATE_URLS,
    MAX_URLS_PER_REQUEST,
    PRODUCTION_ORIGIN,
    ROBOTS_URL,
    ROOT_SITEMAP_URL,
    SPLIT_SITEMAP_URL,
    assertSplitPageIndexable,
    collectDeployedUrls,
    fetchSitemapUrls,
    hasNoindexDirective,
    isSplitPublicUrl,
    parseSitemapXml,
    readValidatedState,
    runIndexNow,
    submitIndexNowBatches,
    validatePublicUrl,
    writeStateAtomic,
    type IndexNowLogger,
    type IndexNowOptions,
} from '../indexnow'

const TEST_KEY = 'test-indexnow-key-1234'
const TEST_KEY_URL = `${PRODUCTION_ORIGIN}/${TEST_KEY}.txt`
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
    chunks?: string[]
    byteChunks?: Uint8Array[]
    noBody?: boolean
    stall?: boolean
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
    const chunks = spec.chunks ?? [spec.body ?? '']
    const encoder = new TextEncoder()
    const byteChunks = spec.byteChunks ?? chunks.map((chunk) => encoder.encode(chunk))
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
        body: spec.noBody
            ? null
            : new ReadableStream<Uint8Array>({
                  start(controller) {
                      for (const chunk of byteChunks) controller.enqueue(chunk)
                      if (!spec.stall) controller.close()
                  },
              }),
        text: async () => chunks.join(''),
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

function robotsText(includeSplit = true): string {
    return [`Sitemap: ${ROOT_SITEMAP_URL}`, ...(includeSplit ? [`Sitemap: ${SPLIT_SITEMAP_URL}`] : [])].join('\n')
}

function htmlDocument(head = '', body = ''): string {
    return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`
}

function addReleasedGate(routes: Map<string, RouteSpec>, includeSplit = true): void {
    routes.set(ROBOTS_URL, { status: 200, contentType: 'text/plain; charset=utf-8', body: robotsText(includeSplit) })
    routes.set(TEST_KEY_URL, { status: 200, contentType: 'text/plain', body: TEST_KEY })
}

function indexableHtml(url: string): string {
    return htmlDocument(`<link rel="canonical" href="${url}">`)
}

function addIndexablePages(routes: Map<string, RouteSpec>, urls: string[]): void {
    for (const url of urls) routes.set(url, { status: 200, contentType: 'text/html', body: indexableHtml(url) })
}

function addReleasedProof(routes: Map<string, RouteSpec>, urls: string[]): void {
    addReleasedGate(routes)
    addIndexablePages(routes, urls)
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
    jest.restoreAllMocks()
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

    test('stops a chunked sitemap response at the byte limit', async () => {
        const { fetchImpl } = createFetch(
            new Map([
                [
                    ROOT_SITEMAP_URL,
                    {
                        status: 200,
                        contentType: 'application/xml',
                        chunks: ['x'.repeat(5 * 1024 * 1024), 'y'.repeat(5 * 1024 * 1024 + 1)],
                    },
                ],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow('byte response limit')
    })

    test('rejects a declared sitemap body over the byte limit before reading it', async () => {
        const { fetchImpl } = createFetch(
            new Map([
                [
                    ROOT_SITEMAP_URL,
                    {
                        status: 200,
                        contentType: 'application/xml',
                        headers: { 'content-length': String(10 * 1024 * 1024 + 1) },
                        body: sitemapXml([HOME]),
                    },
                ],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow('byte response limit')
    })

    test.each(['', '01', '1e3', '-1', '+1', ' 1'])('rejects invalid Content-Length %p', async (length) => {
        const { fetchImpl } = createFetch(
            new Map([
                [
                    ROOT_SITEMAP_URL,
                    {
                        status: 200,
                        contentType: 'application/xml',
                        headers: { 'content-length': length },
                        body: sitemapXml([HOME]),
                    },
                ],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow('invalid Content-Length')
    })

    test('never falls back to an unbounded text read when the response has no body stream', async () => {
        const { fetchImpl } = createFetch(
            new Map([
                [
                    ROOT_SITEMAP_URL,
                    { status: 200, contentType: 'application/xml', body: sitemapXml([HOME]), noBody: true },
                ],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow(`Invalid sitemap XML from ${ROOT_SITEMAP_URL}`)
    })

    test('rejects invalid UTF-8 without reflecting remote bytes', async () => {
        const { fetchImpl } = createFetch(
            new Map([
                [
                    ROOT_SITEMAP_URL,
                    { status: 200, contentType: 'application/xml', byteChunks: [new Uint8Array([0xff, 0xfe])] },
                ],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        ).rejects.toThrow(`${ROOT_SITEMAP_URL} is not valid UTF-8`)
    })

    test('cancels a stalled response body at the timeout', async () => {
        const { fetchImpl } = createFetch(
            new Map([
                [ROOT_SITEMAP_URL, { status: 200, contentType: 'application/xml', chunks: ['<urlset'], stall: true }],
            ])
        )
        await expect(
            fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 10 })
        ).rejects.toThrow('timed out')
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

    test.each([
        SIX_SPLIT_URLS[0],
        `${PRODUCTION_ORIGIN}/EN/split/guides/unknown`,
        `${PRODUCTION_ORIGIN}/en/split/unknown/future`,
        `${PRODUCTION_ORIGIN}/split-static/a.js`,
        SPLIT_SITEMAP_URL,
    ])('rejects renderer-owned URL %s leaked into the root sitemap', async (split) => {
        const routes = deployedRoutes([HOME, split], [SIX_SPLIT_URLS[0]])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).rejects.toThrow(
            'renderer-owned Split namespace'
        )
    })

    test('deduplicates within each owner sitemap while preserving deployed order', async () => {
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, HOME], [split, split])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).resolves.toEqual({
            rootUrls: [HOME],
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

    test('accepts future manifest-backed locale and route families without an IndexNow code change', async () => {
        const futureSplitUrls = [
            `${PRODUCTION_ORIGIN}/de/split`,
            `${PRODUCTION_ORIGIN}/zh-hans-cn/split/guides/future-guide`,
            `${PRODUCTION_ORIGIN}/fr/split/alternatives/venmo`,
            `${PRODUCTION_ORIGIN}/de/split/tools`,
            `${PRODUCTION_ORIGIN}/de/split/tools/rent-split-calculator`,
        ]
        const routes = deployedRoutes([HOME], futureSplitUrls)
        const { fetchImpl } = createFetch(routes)

        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).resolves.toMatchObject({
            splitSitemapUrls: futureSplitUrls,
            splitUrls: futureSplitUrls,
            allUrls: [HOME, ...futureSplitUrls],
        })
    })

    test.each([
        `${PRODUCTION_ORIGIN}/pay/split`,
        `${PRODUCTION_ORIGIN}/qr/split/tools/rent`,
        `${PRODUCTION_ORIGIN}/english/split/guides/future-guide`,
        `${PRODUCTION_ORIGIN}/EN/split/guides/future-guide`,
        `${PRODUCTION_ORIGIN}/de/split/unknown/future-guide`,
    ])('does not classify a product, malformed locale, or unsupported route as Split: %s', (url) => {
        expect(isSplitPublicUrl(url)).toBe(false)
    })

    test.each(['?preview=1', '?'])('rejects a query-bearing Split sitemap URL suffix %p', async (suffix) => {
        const splitWithQuery = `${SIX_SPLIT_URLS[0]}${suffix}`
        const routes = deployedRoutes([HOME], [splitWithQuery])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).rejects.toThrow('Split URL with a query')
    })

    test.each([`${NEW_ROOT_URL}?campaign=1`, `${NEW_ROOT_URL}?`])(
        'rejects query-bearing root sitemap URL %p',
        async (url) => {
            const routes = deployedRoutes([HOME, url])
            const { fetchImpl } = createFetch(routes)
            await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).rejects.toThrow(
                'deployed sitemap URL 2 must not contain a query'
            )
        }
    )

    test('rejects a query-bearing Split URL even when it appears in the root sitemap', async () => {
        const routes = deployedRoutes([HOME, `${SIX_SPLIT_URLS[0]}?preview=1`])
        const { fetchImpl } = createFetch(routes)
        await expect(collectDeployedUrls({ fetchImpl, timeoutMs: 1_000 })).rejects.toThrow(
            'deployed sitemap URL 2 must not contain a query'
        )
    })

    test('does not reflect a remote transport error into the thrown message', async () => {
        const remoteMessage = '\u001b[31mREMOTE_SECRET\nsecond line'
        const { fetchImpl } = createFetch(new Map([[ROOT_SITEMAP_URL, new Error(remoteMessage)]]))
        let message = ''
        try {
            await fetchSitemapUrls({ fetchImpl, url: ROOT_SITEMAP_URL, optional: false, timeoutMs: 1_000 })
        } catch (error) {
            message = error instanceof Error ? error.message : String(error)
        }
        expect(message).toBe(`Request failed for ${ROOT_SITEMAP_URL}`)
        expect(message).not.toContain('REMOTE_SECRET')
        expect(message).not.toContain('\u001b')
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
        [
            'query-bearing Split URL',
            JSON.stringify({
                version: 1,
                urls: [`${SIX_SPLIT_URLS[0]}?preview=1`],
                writtenAt: '2026-08-11T18:00:00.000Z',
                reason: 'bootstrap',
            }),
        ],
        [
            'query-bearing ordinary URL',
            JSON.stringify({
                version: 1,
                urls: [`${NEW_ROOT_URL}?campaign=1`],
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

    test('does not reflect corrupt state content in its parse error', () => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, '\u001b[31mLOCAL_CACHE_SECRET')
        let message = ''
        try {
            readValidatedState(file)
        } catch (error) {
            message = error instanceof Error ? error.message : String(error)
        }
        expect(message).toContain('could not parse JSON')
        expect(message).not.toContain('LOCAL_CACHE_SECRET')
        expect(message).not.toContain('\u001b')
    })

    test('rejects oversized state before reading its contents', () => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, '')
        fs.truncateSync(file, MAX_STATE_BYTES + 1)
        expect(() => readValidatedState(file)).toThrow(`at most ${MAX_STATE_BYTES} bytes`)
    })

    test('rejects a symbolic-link state file', () => {
        const file = statePath()
        const target = path.join(path.dirname(path.dirname(file)), 'target.json')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(
            target,
            JSON.stringify({ version: 1, urls: [], writtenAt: '2026-08-11T18:00:00.000Z', reason: 'bootstrap' })
        )
        fs.symlinkSync(target, file)
        expect(() => readValidatedState(file)).toThrow('expected a file')
    })

    test('reads and validates through one descriptor when the pathname is swapped after open', () => {
        const file = statePath()
        const replacement = path.join(path.dirname(path.dirname(file)), 'replacement.json')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(
            file,
            JSON.stringify({ version: 1, urls: [HOME], writtenAt: '2026-08-11T18:00:00.000Z', reason: 'bootstrap' })
        )
        fs.writeFileSync(
            replacement,
            JSON.stringify({
                version: 1,
                urls: ['https://evil.example/page'],
                writtenAt: '2026-08-11T18:00:00.000Z',
                reason: 'bootstrap',
            })
        )
        const realFstat = fs.fstatSync.bind(fs)
        jest.spyOn(fs, 'fstatSync').mockImplementationOnce((descriptor) => {
            fs.unlinkSync(file)
            fs.symlinkSync(replacement, file)
            return realFstat(descriptor)
        })

        expect(readValidatedState(file)).toMatchObject({ urls: [HOME], reason: 'bootstrap' })
    })

    test('enforces the byte bound when an opened state file grows after fstat', () => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, '{}')
        const realFstat = fs.fstatSync.bind(fs)
        jest.spyOn(fs, 'fstatSync').mockImplementationOnce((descriptor) => {
            const originalStat = realFstat(descriptor)
            fs.truncateSync(file, MAX_STATE_BYTES + 1)
            return originalStat
        })

        expect(() => readValidatedState(file)).toThrow(`at most ${MAX_STATE_BYTES} bytes`)
    })

    test('closes the no-follow descriptor when descriptor validation fails', () => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, '{}')
        const close = jest.spyOn(fs, 'closeSync')
        jest.spyOn(fs, 'fstatSync').mockImplementationOnce(() => {
            throw new Error('adversarial fstat failure')
        })

        expect(() => readValidatedState(file)).toThrow('adversarial fstat failure')
        expect(close).toHaveBeenCalledWith(expect.any(Number))
    })

    test('refuses to write state through a symbolic-link directory', () => {
        const file = statePath()
        const stateDirectory = path.dirname(file)
        const targetDirectory = path.join(path.dirname(stateDirectory), 'target-state')
        fs.mkdirSync(targetDirectory, { recursive: true })
        fs.symlinkSync(targetDirectory, stateDirectory)
        expect(() => writeStateAtomic(file, [HOME], 'bootstrap')).toThrow('symbolic link')
        expect(fs.readdirSync(targetDirectory)).toEqual([])
    })

    test('refuses to write more than the bounded state URL cardinality', () => {
        const file = statePath()
        expect(() => writeStateAtomic(file, new Array(MAX_STATE_URLS + 1).fill(HOME), 'bootstrap')).toThrow(
            `${MAX_STATE_URLS} URLs`
        )
        expect(fs.existsSync(file)).toBe(false)
    })

    test('refuses to write a query-bearing Split URL to durable state', () => {
        const file = statePath()
        expect(() => writeStateAtomic(file, [`${SIX_SPLIT_URLS[0]}?preview=1`], 'bootstrap')).toThrow(
            'must not contain a query'
        )
        expect(fs.existsSync(file)).toBe(false)
    })

    test.each([`${NEW_ROOT_URL}?campaign=1`, `${NEW_ROOT_URL}?`])(
        'refuses to write query-bearing ordinary URL %p to durable state',
        (url) => {
            const file = statePath()
            expect(() => writeStateAtomic(file, [url], 'bootstrap')).toThrow('must not contain a query')
            expect(fs.existsSync(file)).toBe(false)
        }
    )

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
        const { fetchImpl, mock } = createFetch(
            new Map([[ROBOTS_URL, { status: 200, contentType: 'text/plain', body: robotsText(false) }]])
        )
        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result.mode).toBe('gate-closed')
        expect(mock).toHaveBeenCalledTimes(1)
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.existsSync(file)).toBe(false)
    })

    test('a released run with missing state fails closed before any API request', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('No validated IndexNow state exists')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.existsSync(file)).toBe(false)
    })

    test('a released run with corrupt state fails closed before any API request', async () => {
        const file = statePath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, '{')
        const before = fs.readFileSync(file, 'utf8')
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('Invalid IndexNow state')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('explicit full dry-run can inspect a missing baseline without writing it', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes)
        const result = await runIndexNow(baseOptions(fetchImpl, file, { full: true, dryRun: true }))
        expect(result).toMatchObject({ mode: 'dry-run', candidates: [HOME, NEW_ROOT_URL, split] })
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.existsSync(file)).toBe(false)
    })

    test('explicit full mode is the only released recovery for an evicted baseline', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 202 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { full: true }))
        expect(result).toMatchObject({ mode: 'submitted', candidates: [HOME, NEW_ROOT_URL, split], batches: 1 })
        expect(apiCalls(mock)).toHaveLength(1)
        expect(readValidatedState(file)).toMatchObject({ urls: [HOME, NEW_ROOT_URL, split], reason: 'submission' })
    })
})

describe('release, noindex, and delta gates', () => {
    test('deployed robots without the Split sitemap closes the live gate before state or sitemap reads', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = new Map<string, RouteSpec>([
            [ROBOTS_URL, { status: 200, contentType: 'text/plain', body: robotsText(false) }],
        ])
        const { fetchImpl, mock } = createFetch(routes)

        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result).toMatchObject({ mode: 'gate-closed', currentUrls: [], candidates: [] })
        expect(mock).toHaveBeenCalledTimes(1)
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test.each([
        ['missing', { status: 404, contentType: 'text/plain', body: '' }],
        ['HTML', { status: 200, contentType: 'text/html', body: robotsText() }],
        ['root-only', { status: 200, contentType: 'text/plain', body: robotsText(false) }],
    ] satisfies Array<[string, ResponseSpec]>)('keeps the live gate closed for %s robots', async (_label, spec) => {
        const file = statePath()
        const { fetchImpl, mock } = createFetch(new Map([[ROBOTS_URL, spec]]))
        await expect(runIndexNow(baseOptions(fetchImpl, file))).resolves.toMatchObject({ mode: 'gate-closed' })
        expect(mock).toHaveBeenCalledTimes(1)
        expect(fs.existsSync(file)).toBe(false)
    })

    test('requires a nonempty direct-200 strict XML Split sitemap after robots opens the gate', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME])
        addReleasedGate(routes)
        const { fetchImpl, mock } = createFetch(routes)

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('required and must not be empty')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test.each([204, 404, 410])('rejects released Split sitemap status %s with zero mutation', async (status) => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME], { status, contentType: 'application/xml', body: '' })
        addReleasedGate(routes)
        const { fetchImpl, mock } = createFetch(routes)

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('expected a direct 200 XML response')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('an oversized robots body cannot open the gate or mutate state', async () => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = new Map<string, RouteSpec>([
            [
                ROBOTS_URL,
                {
                    status: 200,
                    contentType: 'text/plain',
                    chunks: [robotsText(), 'x'.repeat(512 * 1024)],
                },
            ],
        ])
        const { fetchImpl, mock } = createFetch(routes)

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('byte response limit')
        expect(mock).toHaveBeenCalledTimes(1)
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('computes additions then deletions in stable deployed/state order', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split, OLD_SPLIT_URL], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
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
        addReleasedProof(routes, SIX_SPLIT_URLS)
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
                body: htmlDocument(),
            },
        ],
        [
            'robots meta',
            {
                status: 200,
                contentType: 'text/html',
                body: htmlDocument('<meta content="follow, NOINDEX" name="robots">'),
            },
        ],
        [
            'Bing meta',
            {
                status: 200,
                contentType: 'text/html',
                body: htmlDocument("<meta name='bingbot' content='noindex'>"),
            },
        ],
    ] satisfies Array<[string, ResponseSpec]>)('refuses a Split page carrying %s noindex', async (_label, page) => {
        const file = statePath()
        writeStateAtomic(file, [HOME], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const split = SIX_SPLIT_URLS[0]
        const routes = deployedRoutes([HOME], [split])
        addReleasedGate(routes)
        routes.set(split, page)
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('still noindex')
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
        addReleasedGate(routes)
        routes.set(split, page)
        const { fetchImpl, mock } = createFetch(routes)

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow()
        expect(apiCalls(mock)).toHaveLength(0)
    })

    test('recognizes header and reordered/meta quoting noindex forms', () => {
        expect(hasNoindexDirective(htmlDocument(), 'max-snippet:20; noindex')).toBe(true)
        expect(hasNoindexDirective(htmlDocument('<META CONTENT=noindex NAME=robots>'), null)).toBe(true)
        expect(hasNoindexDirective(htmlDocument('<meta name="robots" content="none">'), null)).toBe(true)
        expect(hasNoindexDirective(htmlDocument('<meta name="googlebot" content="noindex">'), null)).toBe(true)
        expect(hasNoindexDirective(htmlDocument(), 'bingbot: none')).toBe(true)
        expect(hasNoindexDirective(htmlDocument(), 'googlebot: noindex, follow')).toBe(true)
        expect(hasNoindexDirective(htmlDocument(), 'max-image-preview:none')).toBe(false)
        expect(hasNoindexDirective(htmlDocument('', '<meta name="robots" content="noindex">'), null)).toBe(true)
        expect(
            hasNoindexDirective(htmlDocument('', '<meta http-equiv="x-robots-tag" content="googlebot:noindex">'), null)
        ).toBe(true)
        expect(
            hasNoindexDirective(
                htmlDocument('', '<meta http-equiv="x-robots-tag" content="max-image-preview:none">'),
                null
            )
        ).toBe(false)
        expect(
            hasNoindexDirective(htmlDocument('', '<template><meta name="robots" content="noindex"></template>'), null)
        ).toBe(false)
        expect(hasNoindexDirective(htmlDocument('<meta name="robots" content="index,follow">'), null)).toBe(false)
        expect(hasNoindexDirective(htmlDocument('<meta data-name="robots" data-content="noindex">'), null)).toBe(false)
        expect(hasNoindexDirective(htmlDocument("<meta data-text=' name=robots content=noindex'>"), null)).toBe(false)
        expect(
            hasNoindexDirective(htmlDocument('<meta name="robots" name="description" content="noindex">'), null)
        ).toBe(true)
        expect(hasNoindexDirective(htmlDocument('<meta name="robots" content="no&#105;ndex">'), null)).toBe(true)
        expect(hasNoindexDirective('<!doctype html><html><head><!-- unterminated', null)).toBe(true)
    })

    test('direct indexability check accepts a clean direct HTML page', async () => {
        const split = SIX_SPLIT_URLS[0]
        const { fetchImpl } = createFetch(
            new Map([[split, { status: 200, contentType: 'text/html; charset=utf-8', body: indexableHtml(split) }]])
        )
        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).resolves.toBeUndefined()
    })

    test('direct indexability check rejects a body robots meta even with a clean head canonical', async () => {
        const split = SIX_SPLIT_URLS[0]
        const { fetchImpl } = createFetch(
            new Map([
                [
                    split,
                    {
                        status: 200,
                        contentType: 'text/html; charset=utf-8',
                        body: htmlDocument(
                            `<link rel="canonical" href="${split}">`,
                            '<meta name="robots" content="noindex">'
                        ),
                    },
                ],
            ])
        )

        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).rejects.toThrow(
            'still noindex'
        )
    })

    test('stops a chunked Split page at the response byte limit', async () => {
        const split = SIX_SPLIT_URLS[0]
        const { fetchImpl } = createFetch(
            new Map([
                [
                    split,
                    {
                        status: 200,
                        contentType: 'text/html',
                        chunks: [indexableHtml(split), 'x'.repeat(5 * 1024 * 1024)],
                    },
                ],
            ])
        )
        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).rejects.toThrow(
            'byte response limit'
        )
    })

    test('accepts a reordered canonical link with a canonical relation token', async () => {
        const split = SIX_SPLIT_URLS[0]
        const html = `<!doctype html><HTML><HEAD><LINK HREF='${split}' REL='alternate CANONICAL'></HEAD><BODY></BODY></HTML>`
        const { fetchImpl } = createFetch(
            new Map([[split, { status: 200, contentType: 'text/html; charset=utf-8', body: html }]])
        )
        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).resolves.toBeUndefined()
    })

    test.each([
        ['missing', htmlDocument()],
        [
            'duplicate',
            htmlDocument(
                `<link rel="canonical" href="${SIX_SPLIT_URLS[0]}"><link rel="canonical" href="${SIX_SPLIT_URLS[0]}">`
            ),
        ],
        ['non-self', htmlDocument(`<link rel="canonical" href="${SIX_SPLIT_URLS[1]}">`)],
        ['comment-only', htmlDocument(`<!-- <link rel="canonical" href="${SIX_SPLIT_URLS[0]}"> -->`)],
        [
            'script-only',
            htmlDocument(`<script>const fake = '<link rel="canonical" href="${SIX_SPLIT_URLS[0]}">'</script>`),
        ],
        ['template-only', htmlDocument(`<template><link rel="canonical" href="${SIX_SPLIT_URLS[0]}"></template>`)],
        ['body-only', htmlDocument('', `<link rel="canonical" href="${SIX_SPLIT_URLS[0]}">`)],
        ['unterminated comment', `<!doctype html><html><head><!-- <link rel="canonical" href="${SIX_SPLIT_URLS[0]}">`],
        [
            'unterminated script',
            `<!doctype html><html><head><script><link rel="canonical" href="${SIX_SPLIT_URLS[0]}">`,
        ],
        [
            'second canonical without href',
            htmlDocument(`<link rel="canonical" href="${SIX_SPLIT_URLS[0]}"><link rel="canonical">`),
        ],
        [
            'data attributes that resemble canonical attributes',
            htmlDocument(`<link data-rel="canonical" data-href="${SIX_SPLIT_URLS[0]}">`),
        ],
        [
            'canonical text embedded in another attribute',
            htmlDocument(`<link data-text=' rel="canonical" href="${SIX_SPLIT_URLS[0]}"'>`),
        ],
        ['duplicate rel attribute', htmlDocument(`<link rel="alternate" rel="canonical" href="${SIX_SPLIT_URLS[0]}">`)],
        [
            'canonical relation with only a data href',
            htmlDocument(`<link rel="canonical" data-href="${SIX_SPLIT_URLS[0]}">`),
        ],
        [
            'valid canonical plus malformed link attributes',
            htmlDocument(`<link rel="canonical" href="${SIX_SPLIT_URLS[0]}"><link rel="preload" rel="stylesheet">`),
        ],
    ])('rejects a %s canonical contract', async (_label, html) => {
        const split = SIX_SPLIT_URLS[0]
        const { fetchImpl } = createFetch(
            new Map([[split, { status: 200, contentType: 'text/html; charset=utf-8', body: html }]])
        )
        await expect(assertSplitPageIndexable({ fetchImpl, url: split, timeoutMs: 1_000 })).rejects.toThrow(
            'exactly one absolute self-canonical'
        )
    })

    test.each([
        ['missing', { status: 404, contentType: 'text/plain', body: '' }],
        ['HTML', { status: 200, contentType: 'text/html', body: TEST_KEY }],
        ['wrong value', { status: 200, contentType: 'text/plain', body: `${TEST_KEY}\n` }],
        ['redirect', { status: 302, contentType: 'text/plain', body: TEST_KEY }],
        [
            'cross-origin final URL',
            { status: 200, contentType: 'text/plain', body: TEST_KEY, url: 'https://evil.example/key.txt' },
        ],
        ['oversized', { status: 200, contentType: 'text/plain', chunks: ['x'.repeat(513)] }],
    ] satisfies Array<[string, ResponseSpec]>)('rejects a %s public IndexNow key proof', async (_label, keySpec) => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        routes.set(TEST_KEY_URL, keySpec)
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow()
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('an unchanged deployed Split regression blocks an unrelated root delta', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split], 'submission')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedGate(routes)
        routes.set(split, {
            status: 200,
            contentType: 'text/html',
            body: htmlDocument('<meta name="robots" content="noindex">'),
        })
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('still noindex')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })
})

describe('IndexNow payload, batching, errors, and state advancement', () => {
    test.each([`${NEW_ROOT_URL}?campaign=1`, `${NEW_ROOT_URL}?`])(
        'rejects query-bearing submission URL %p before the API call',
        async (url) => {
            const { fetchImpl, mock } = createFetch(new Map(), [{ status: 200 }])
            await expect(
                submitIndexNowBatches({
                    fetchImpl,
                    endpoint: INDEXNOW_ENDPOINT,
                    key: TEST_KEY,
                    urls: [url],
                    timeoutMs: 1_000,
                    logger,
                })
            ).rejects.toThrow('must not contain a query')
            expect(apiCalls(mock)).toHaveLength(0)
        }
    )

    test.each([200, 202])('accepts exact protocol success status %s and advances state atomically', async (status) => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split], 'bootstrap')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status }])

        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result).toMatchObject({ mode: 'submitted', candidates: [NEW_ROOT_URL], batches: 1 })
        expect(readValidatedState(file)).toMatchObject({ urls: [HOME, NEW_ROOT_URL, split], reason: 'submission' })

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
            const split = SIX_SPLIT_URLS[0]
            writeStateAtomic(file, [HOME, split], 'bootstrap')
            const before = fs.readFileSync(file, 'utf8')
            const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
            addReleasedProof(routes, [split])
            const { fetchImpl } = createFetch(routes, [{ status, body: `status-${status}` }])

            await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('state was not advanced')
            expect(fs.readFileSync(file, 'utf8')).toBe(before)
        }
    )

    test('logs only the status for an oversized control-bearing API error body', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const remoteBody = `\u001b[31mREMOTE_API_SECRET\n${'x'.repeat(1024 * 1024)}`
        const { fetchImpl } = createFetch(routes, [{ status: 500, chunks: [remoteBody] }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('state was not advanced')
        expect(logger.error).toHaveBeenCalledWith('IndexNow batch 1 failed with 500')
        const logged = (logger.error as jest.Mock).mock.calls.flat().join('\n')
        expect(logged).not.toContain('REMOTE_API_SECRET')
        expect(logged).not.toContain('\u001b')
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('uses stable batches of 10,000 and then one URL', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [split], 'bootstrap')
        const urls = Array.from(
            { length: MAX_URLS_PER_REQUEST + 1 },
            (_, index) => `${PRODUCTION_ORIGIN}/en/batch-${String(index).padStart(5, '0')}`
        )
        const routes = deployedRoutes(urls, [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }, { status: 202 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result).toMatchObject({ mode: 'submitted', batches: 2 })
        const calls = apiCalls(mock)
        expect(calls).toHaveLength(2)
        expect(JSON.parse(String(calls[0][1]?.body)).urlList).toEqual(urls.slice(0, MAX_URLS_PER_REQUEST))
        expect(JSON.parse(String(calls[1][1]?.body)).urlList).toEqual(urls.slice(MAX_URLS_PER_REQUEST))
        expect(readValidatedState(file)?.urls).toEqual([...urls, split])
    })

    test('continues later batches after a transport failure and advances no state', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [split], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const urls = Array.from(
            { length: MAX_URLS_PER_REQUEST + 1 },
            (_, index) => `${PRODUCTION_ORIGIN}/en/transport-${String(index).padStart(5, '0')}`
        )
        const routes = deployedRoutes(urls, [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [new Error('network down'), { status: 200 }])

        await expect(runIndexNow(baseOptions(fetchImpl, file))).rejects.toThrow('state was not advanced')
        expect(apiCalls(mock)).toHaveLength(2)
        const logged = (logger.error as jest.Mock).mock.calls.flat().join('\n')
        expect(logged).toContain('IndexNow batch 1 request failed')
        expect(logged).not.toContain('network down')
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })

    test('submits a disappeared Split URL as a deletion without demanding a live page', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split, OLD_SPLIT_URL], 'submission')
        const routes = deployedRoutes([HOME], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file))
        expect(result).toMatchObject({ deleted: [OLD_SPLIT_URL], candidates: [OLD_SPLIT_URL] })
        expect(mock).toHaveBeenCalledTimes(6)
        expect(JSON.parse(String(apiCalls(mock)[0][1]?.body)).urlList).toEqual([OLD_SPLIT_URL])
        expect(readValidatedState(file)?.urls).toEqual([HOME, split])
    })

    test('dry-run never calls the API or changes an existing state file', async () => {
        const file = statePath()
        const split = SIX_SPLIT_URLS[0]
        writeStateAtomic(file, [HOME, split], 'bootstrap')
        const before = fs.readFileSync(file, 'utf8')
        const routes = deployedRoutes([HOME, NEW_ROOT_URL], [split])
        addReleasedProof(routes, [split])
        const { fetchImpl, mock } = createFetch(routes, [{ status: 200 }])

        const result = await runIndexNow(baseOptions(fetchImpl, file, { dryRun: true }))
        expect(result.mode).toBe('dry-run')
        expect(apiCalls(mock)).toHaveLength(0)
        expect(fs.readFileSync(file, 'utf8')).toBe(before)
    })
})

describe('workflow fail-closed contract', () => {
    test('bounds the entire IndexNow job below the hosted runner default', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')

        expect(workflow).toMatch(/jobs:\n\s+ping:\n(?:\s+[^\n]*\n)*?\s+timeout-minutes: 30(?:\n|$)/)
        expect(workflow).not.toMatch(/timeout-minutes:\s*(?:[0-9]|1[0-9]|2[0-9])(?:\n|$)/)
    })

    test('uses supported Node 22 and no independent index release variable', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')
        expect(workflow).toContain("node-version: '22'")
        expect(workflow).not.toContain('node-version-file:')
        expect(workflow).not.toContain('INDEXNOW_INDEX_RELEASED')
        expect(workflow).not.toContain('vars.')
        expect(workflow).toContain('pnpm install --frozen-lockfile --ignore-scripts')
        expect(workflow).toMatch(/dry_run:[\s\S]*?default: true/)
        expect(workflow).toMatch(/bootstrap:[\s\S]*?default: false/)
        expect(workflow).toMatch(/full:[\s\S]*?default: false/)
        expect(workflow).toContain("hashFiles('.indexnow-state/urls.json') != ''")

        const productionKey = workflow.match(/INDEXNOW_KEY: '([A-Za-z0-9-]+)'/)?.[1]
        expect(productionKey).toBeDefined()
        expect(fs.readFileSync(path.join(process.cwd(), 'public', `${productionKey}.txt`), 'utf8')).toBe(productionKey)

        const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
            engines: { node: string }
        }
        expect(packageJson.engines.node).toContain('^20.9.0')
        expect(packageJson.engines.node).toContain('^22.0.0')
    })

    test('uses only cache-writable trusted triggers in the main-branch state scope', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')
        expect(workflow).toContain('schedule:')
        expect(workflow).toContain("cron: '17,47 * * * *'")
        expect(workflow).toContain('workflow_dispatch:')
        expect(workflow).not.toContain('deployment_status:')
        expect(workflow).toContain("if: github.ref == 'refs/heads/main'")
        expect(workflow).toContain('group: indexnow-state-main')
        expect(workflow).toContain('cancel-in-progress: false')
    })

    test('restores and saves immutable state without reusing a commit-keyed cache', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')
        expect(workflow).toContain('key: indexnow-state-v1-restore-${{ github.run_id }}-${{ github.run_attempt }}')
        expect(workflow).toContain('restore-keys: indexnow-state-v1-')
        expect(workflow).toContain("key: indexnow-state-v1-${{ hashFiles('.indexnow-state/urls.json') }}")
        expect(workflow).not.toMatch(/key: indexnow-state[^\n]*github\.sha/)
    })

    test('pins every third-party action to a full immutable commit SHA', () => {
        const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/indexnow.yml'), 'utf8')
        const actions = [...workflow.matchAll(/^\s*- uses: (\S+)/gm)].map((match) => match[1])
        expect(actions).toHaveLength(5)
        for (const action of actions) expect(action).toMatch(/^[^@\s]+@[0-9a-f]{40}$/)
        expect(actions).toEqual([
            'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
            'actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86',
            'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
            'actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
        ])
        expect(workflow).toContain('persist-credentials: false')
    })
})
