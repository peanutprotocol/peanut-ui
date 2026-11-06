import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { COLLECTION_LOCALES, FLOW_PAGE_MAX_STEPS } from '../collection-core.mjs'
import collections from '../collection-worker/index.mjs'
import { runFlowPageContract } from './flow-page-contract.mjs'
import mcp from './index.mjs'

const version = '2026-07-28'
const legacyVersion = '2025-11-25'
const audience = 'test-audience'
const digest = (value) => createHash('sha256').update(value).digest('hex')
const identity = (email) => ({ access: { aud: audience, getIdentity: async () => ({ email }) } })
const reviewer = identity('reviewer@peanut.me')
const tool = 'create_flow_page'
const input = { title: 'Registration', flows: [{ title: 'Start', items: [{ id: 'screen-a' }] }] }

function fixture() {
    const objects = new Map()
    let postWriteError = false
    let dispatches = 0
    let pendingHeads = 0
    let peakHeads = 0
    let headCount = 0
    const env = {
        REPORTS: {
            async get(key) {
                const object = objects.get(key)
                return object ? { ...object, json: async () => JSON.parse(object.body) } : null
            },
            async head(key) {
                headCount++
                pendingHeads++
                peakHeads = Math.max(peakHeads, pendingHeads)
                await new Promise((resolve) => setImmediate(resolve))
                pendingHeads--
                return objects.get(key) ?? null
            },
            async put(key, body, { onlyIf, customMetadata } = {}) {
                if (onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null
                objects.set(key, { body, customMetadata })
                if (postWriteError) {
                    postWriteError = false
                    throw new Error('Response lost after write')
                }
                return objects.get(key)
            },
        },
        COLLECTION_SERVICE_TOKEN: 'test-token',
        SCREEN_LIBRARY_ACCESS_AUD: audience,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://gallery.example',
        SCREEN_LIBRARY_MCP_URL: 'https://mcp.example',
        GITHUB_REPOSITORY: 'example/example',
        GITHUB_ACTIONS_TOKEN: 'fixture',
        GITHUB_FETCH() {
            dispatches++
            throw new Error('Unexpected GitHub request')
        },
        COLLECTIONS: { fetch: (request) => collections.fetch(request, env) },
    }
    function request(path, { body, headers, context = reviewer } = {}) {
        return collections.fetch(
            new Request('https://api.example' + path, {
                method: body === undefined ? 'GET' : 'POST',
                ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
                headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
            }),
            env,
            context
        )
    }
    async function call(method, { params = {}, modern = true, authenticated = true, headers = {} } = {}) {
        const response = await mcp.fetch(
            new Request('https://mcp.example/mcp', {
                method: 'POST',
                headers: {
                    Host: 'mcp.example',
                    'Content-Type': 'application/json',
                    Accept: 'application/json, text/event-stream',
                    'MCP-Protocol-Version': modern ? version : legacyVersion,
                    ...(modern ? { 'Mcp-Method': method } : {}),
                    ...(modern && params.name ? { 'Mcp-Name': params.name } : {}),
                    ...headers,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params: modern
                        ? {
                              ...params,
                              _meta: {
                                  'io.modelcontextprotocol/protocolVersion': version,
                                  'io.modelcontextprotocol/clientInfo': { name: 'contract-harness', version: '1.0.0' },
                                  'io.modelcontextprotocol/clientCapabilities': {},
                              },
                          }
                        : params,
                }),
            }),
            env,
            authenticated ? reviewer : undefined
        )
        const body = await response.text()
        const contentType = response.headers.get('Content-Type')
        const envelope = contentType?.includes('text/event-stream')
            ? JSON.parse(
                  body
                      .split('\n')
                      .find((line) => line.startsWith('data: '))
                      .slice(6)
              )
            : contentType?.includes('application/json')
              ? JSON.parse(body)
              : null
        return { response, envelope }
    }
    function seed({ screenId, locale, sequence = 1, separateThumbnail = false }) {
        const commit = digest(locale + '-' + sequence).slice(0, 40)
        const path = ['2026-11-06', 'compare-dev', locale.toLowerCase(), commit].join('/')
        const reportKey = 'reports/' + path + '/manifest.json'
        const id = digest([screenId, locale, sequence].join('-')) + '.webp'
        const thumbnail = separateThumbnail ? digest('thumbnail-' + id) + '.webp' : id
        const report = JSON.parse(
            objects.get(reportKey)?.body ??
                JSON.stringify({
                    schema: 1,
                    type: 'capture',
                    commit,
                    locale,
                    screens: [],
                })
        )
        report.screens.push({ id: screenId, status: 'captured', image: id, thumbnail })
        const entries = JSON.parse(objects.get('index.json')?.body ?? '[]')
        if (!entries.some((entry) => entry.path === path))
            entries.push({ path, locale, reportType: 'capture', branch: 'dev', complete: true, sequence })
        objects.set('index.json', { body: JSON.stringify(entries) })
        objects.set('reports/' + path + '/manifest.json', { body: JSON.stringify(report) })
        objects.set('assets/' + id, { body: 'fixture-image' })
        objects.set('assets/' + thumbnail, { body: 'fixture-thumbnail' })
        return { id, screenId, locale }
    }
    async function read(id) {
        const response = await request('/v1/collections/' + id)
        assert.equal(response.status, 200)
        return (await response.json()).collection
    }
    return {
        objects,
        request,
        call,
        seed,
        read,
        manifestCount: () => [...objects.keys()].filter((key) => key.startsWith('collections/')).length,
        dropWriteResponse() {
            postWriteError = true
        },
        assetChecks: () => ({ headCount, peakHeads }),
        counters: () => ({
            dispatches,
            uploads: [...objects.keys()].filter((key) => key.startsWith('assets/')).length,
            captures: [...objects.keys()].filter((key) => key.startsWith('collection-requests/')).length,
        }),
    }
}

test('frozen Flow Page contract through collection Worker and actual v2 MCP HTTP handler', async () => {
    const f = fixture()
    // The generic contract uses fixture aliases. Peanut supports en/es-419/es-AR/pt-BR.
    const toProductLocale = (locale) => ({ fr: 'es-419', pt: 'pt-BR' })[locale] ?? locale
    const toContractLocale = (locale) => ({ 'es-419': 'fr', 'pt-BR': 'pt' })[locale] ?? locale
    const argumentsFor = (value) => ({ ...value, locales: value.locales?.map(toProductLocale) })
    const outputFor = (value) => ({ ...value, locales: value.locales.map(toContractLocale) })
    let seedUploads = 0
    async function callTool({ name, arguments: args, authenticated }, modern) {
        const { response, envelope } = await f.call('tools/call', {
            params: { name, arguments: argumentsFor(args) },
            modern,
            authenticated,
        })
        assert.equal(response.status, 200, JSON.stringify(envelope))
        assert.ok(!envelope.error && !envelope.result.isError, JSON.stringify(envelope))
        const page = envelope.result.structuredContent
        assert.deepEqual(JSON.parse(envelope.result.content[0].text), page)
        return outputFor(page)
    }
    await runFlowPageContract({
        maxTotalSteps: FLOW_PAGE_MAX_STEPS,
        seedPublishedAsset({ screenId, locale }) {
            seedUploads++
            return f.seed({ screenId, locale: toProductLocale(locale) })
        },
        async createFlowPage(args, { authenticated }) {
            const response = await f.request('/v1/flow-pages', {
                body: argumentsFor(args),
                context: authenticated ? reviewer : null,
            })
            const data = await response.json()
            if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status })
            return outputFor(data)
        },
        async readPage(id) {
            const page = await f.read(id)
            return {
                ...page,
                manifests: page.flows.map((flow) => ({
                    title: flow.title,
                    steps: flow.items.map((step) => {
                        const item = page.items.find((entry) => entry.id === step.id)
                        const assets = Object.entries(item.variants).map(([locale, variant]) => ({
                            locale: toContractLocale(locale),
                            assetId: variant.image,
                        }))
                        return { ...step, ...assets[0], assets }
                    }),
                })),
            }
        },
        publishedManifestCount: f.manifestCount,
        readLegacyCollection: f.read,
        async discoverTools({ protocolVersion }) {
            assert.equal(protocolVersion, version)
            const discovered = await f.call('server/discover')
            assert.equal(discovered.response.status, 200)
            assert.ok(discovered.envelope.result.supportedVersions.includes(version))
            assert.equal(discovered.envelope.result.resultType, 'complete')
            assert.equal(discovered.envelope.result.cacheScope, 'private')
            assert.equal(
                discovered.envelope.result._meta['io.modelcontextprotocol/serverInfo'].name,
                'Peanut screen library'
            )
            const listed = await f.call('tools/list')
            assert.equal(listed.response.status, 200)
            const schema = listed.envelope.result.tools.find((entry) => entry.name === tool)
            assert.ok(schema.inputSchema.properties.flows)
            assert.ok(schema.outputSchema.properties.url)
            return listed.envelope.result
        },
        callTool: (args) => callTool(args, true),
        callLegacyTool: (args) => callTool(args, false),
        counters() {
            const totals = f.counters()
            return { ...totals, uploads: totals.uploads - seedUploads }
        },
    })
})

test('a lost write response recovers the pinned page despite a new source, scoped to the verified actor', async () => {
    const f = fixture()
    const first = f.seed({ screenId: 'screen-a', locale: 'en' })
    const body = { ...input, requestId: 'recover-lost-response' }
    f.dropWriteResponse()
    assert.equal((await f.request('/v1/flow-pages', { body })).status, 503)
    assert.equal(f.manifestCount(), 1)
    const newer = f.seed({ screenId: 'screen-a', locale: 'en', sequence: 2 })
    const replay = await f.request('/v1/flow-pages', { body: { ...body, title: ' Registration ', locales: ['en'] } })
    assert.equal(replay.status, 200)
    const replayed = await replay.json()
    const pinned = await f.read(replayed.id)
    assert.equal(pinned.items[0].variants.en.image, first.id)
    assert.ok(!JSON.stringify(pinned).includes('reviewer@peanut.me'))
    assert.equal(f.manifestCount(), 1)
    const other = await f.request('/v1/flow-pages', {
        body,
        context: identity('other@peanut.me'),
        headers: { 'X-Screen-Library-Actor': encodeURIComponent('reviewer@peanut.me') },
    })
    assert.equal(other.status, 201)
    const second = await other.json()
    assert.notEqual(second.id, replayed.id)
    assert.equal((await f.read(second.id)).items[0].variants.en.image, newer.id)

    const { envelope } = await f.call('tools/call', {
        params: { name: tool, arguments: body },
        headers: { 'X-Screen-Library-Actor': encodeURIComponent('other@peanut.me') },
    })
    assert.equal(envelope.result.structuredContent.id, replayed.id)
    assert.equal(f.manifestCount(), 2)
})

test('legacy clients can initialize, discover, and call the existing screen search tool', async () => {
    const f = fixture()
    f.seed({ screenId: 'screen-a', locale: 'en' })
    const initialized = await f.call('initialize', {
        modern: false,
        params: {
            protocolVersion: legacyVersion,
            capabilities: {},
            clientInfo: { name: 'legacy-harness', version: '1.0.0' },
        },
    })
    assert.equal(initialized.response.status, 200)
    assert.equal(initialized.envelope.result.protocolVersion, legacyVersion)
    const listed = await f.call('tools/list', { modern: false })
    assert.ok(listed.envelope.result.tools.some((entry) => entry.name === 'create_collection'))
    const search = await f.call('tools/call', {
        modern: false,
        params: { name: 'search_screens', arguments: { query: 'screen-a' } },
    })
    assert.equal(search.response.status, 200)
    assert.equal(JSON.parse(search.envelope.result.content[0].text).screens[0].id, 'screen-a')
    assert.equal(f.manifestCount(), 0)
})

test('routing, Access, unsupported locales, malformed bodies and missing object failures never publish', async () => {
    const f = fixture()
    const { id } = f.seed({ screenId: 'screen-a', locale: 'en' })
    f.objects.delete('assets/' + id)
    const params = { name: tool, arguments: input }
    const unauthorized = await f.call('tools/call', { params, authenticated: false })
    assert.equal(unauthorized.response.status, 401)
    for (const headers of [
        { 'Mcp-Method': 'tools/list' },
        { 'Mcp-Name': 'search_screens' },
        { 'MCP-Protocol-Version': '2026-12-01' },
    ]) {
        const rejected = await f.call('tools/call', { params, headers })
        assert.equal(rejected.response.status, 400)
        assert.ok(rejected.envelope.error)
    }
    const missing = await f.call('tools/call', { params })
    assert.equal(missing.envelope.result.isError, true)
    assert.match(missing.envelope.result.content[0].text, /screen-a.*not published in en/)
    const unauthorizedForwarding = await f.request('/v1/flow-pages', {
        body: input,
        context: null,
        headers: { 'X-Screen-Library-Actor': 'reviewer%40peanut.me' },
    })
    assert.equal(unauthorizedForwarding.status, 401)
    for (const body of [
        { ...input, locales: ['fr'] },
        { ...input, profile: '320x712' },
        { ...input, flows: [] },
        { ...input, flows: [{ title: ' ', items: [{ id: 'screen-a' }] }] },
        '{',
        JSON.stringify(input) + ' '.repeat(256 * 1024),
    ]) {
        assert.equal((await f.request('/v1/flow-pages', { body })).status, 400)
    }
    assert.equal(f.manifestCount(), 0)
})

test('concurrent conflicting payloads cannot overwrite the winner', async () => {
    const f = fixture()
    f.seed({ screenId: 'screen-a', locale: 'en' })
    const first = { ...input, requestId: 'conflicting-race' }
    const second = { ...first, title: 'Other page' }
    const responses = await Promise.all([first, second].map((body) => f.request('/v1/flow-pages', { body })))
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
    const created = await responses.find((response) => response.status === 201).json()
    const stored = await f.read(created.id)
    assert.equal(stored.title, created.title)
    assert.equal(f.manifestCount(), 1)
})

test('Access-authenticated creation rejects cross-origin and non-JSON requests', async () => {
    const f = fixture()
    f.seed({ screenId: 'screen-a', locale: 'en' })
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'application/json']) {
        const response = await f.request('/v1/flow-pages', {
            body: input,
            headers: { Origin: 'https://other.example', 'Content-Type': contentType },
        })
        assert.equal(response.status, 403)
    }
    const simplePost = await f.request('/v1/flow-pages', {
        body: input,
        headers: { 'Content-Type': 'text/plain' },
    })
    assert.equal(simplePost.status, 415)
    assert.equal(f.manifestCount(), 0)
    const sameOrigin = await f.request('/v1/flow-pages', {
        body: input,
        headers: { Origin: 'https://api.example', 'Content-Type': 'application/json; charset=UTF-8' },
    })
    assert.equal(sameOrigin.status, 201)
})

test('the maximum locale and screen matrix checks all 800 assets with no more than six concurrent heads', async () => {
    const f = fixture()
    const items = Array.from({ length: FLOW_PAGE_MAX_STEPS }, (_, index) => ({ id: 'screen-' + index }))
    for (const locale of COLLECTION_LOCALES) {
        for (const { id } of items) f.seed({ screenId: id, locale, separateThumbnail: true })
    }
    const response = await f.request('/v1/flow-pages', {
        body: { ...input, locales: COLLECTION_LOCALES, flows: [{ title: 'All screens', items }] },
    })
    assert.equal(response.status, 201)
    assert.deepEqual(f.assetChecks(), { headCount: 800, peakHeads: 6 })
    assert.equal(f.manifestCount(), 1)
})
