import assert from 'node:assert/strict'
import test from 'node:test'
import { COLLECTION_LOCALES } from '../collection-core.mjs'
import { runFlowPageContract } from './flow-page-contract.mjs'
import { fixture, identity, legacyVersion, reviewer, version } from './flow-page-fixture.mjs'

const tool = 'create_flow_page'
const input = { title: 'Registration', flows: [{ title: 'Start', items: [{ id: 'screen-a' }] }] }

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
        maxRequestBytes: 256 * 1024,
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

test('the four-locale 100-screen matrix checks all 800 assets with no more than six concurrent heads', async () => {
    const f = fixture()
    const items = Array.from({ length: 100 }, (_, index) => ({ id: 'screen-' + index }))
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

test('more than 100 branches can share a single published screen', async () => {
    const f = fixture()
    f.seed({ screenId: 'screen-a', locale: 'en' })
    const flows = Array.from({ length: 110 }, (_, index) => ({
        title: 'Branch ' + index,
        items: [{ id: 'screen-a', note: 'Outcome ' + index }],
    }))
    const { envelope } = await f.call('tools/call', {
        params: { name: tool, arguments: { ...input, flows } },
    })
    assert.ok(!envelope.error && !envelope.result.isError, JSON.stringify(envelope))
    const manifest = await f.read(envelope.result.structuredContent.id)
    assert.deepEqual(manifest.flows, flows)
    assert.equal(manifest.items.length, 1)
    assert.deepEqual(f.assetChecks(), { headCount: 1, peakHeads: 1 })
})

test('catalogue-scale verification checks exact paginated R2 keys and rejects absent thumbnails', async () => {
    const f = fixture({
        listHistory({ prefix, cursor }) {
            if (prefix === 'assets/ff' && cursor === undefined)
                return { objects: [{ key: prefix + '0'.repeat(62) + '.webp' }], truncated: true, cursor: '0' }
        },
    })
    const items = Array.from({ length: 505 }, (_, index) => ({ id: 'screen-' + index }))
    const assets = items.map(({ id }) => f.seed({ screenId: id, locale: 'en', separateThumbnail: true }))
    const body = { ...input, flows: [{ title: 'Catalogue screens', items }] }
    const response = await f.request('/v1/flow-pages', { body })
    assert.equal(response.status, 201)
    assert.equal(
        f.assetListings(),
        new Set([...f.objects.keys()].filter((key) => key.startsWith('assets/')).map((key) => key.slice(0, 9))).size + 1
    )
    assert.deepEqual(f.assetChecks(), { headCount: 0, peakHeads: 0 })
    const page = await f.read((await response.json()).id)
    const last = page.items.at(-1)
    assert.equal(last.variants.en.image, assets.at(-1).id)
    assert.notEqual(last.variants.en.image, last.variants.en.thumbnail)

    f.objects.delete('assets/' + last.variants.en.thumbnail)
    const rejected = await f.request('/v1/flow-pages', { body })
    assert.equal(rejected.status, 400)
    assert.match((await rejected.json()).error, /screen-504.*not published in en/)
    assert.equal(f.manifestCount(), 1)
})

test('busy hash prefixes fall back to exact HEADs only when the request budget can cover them', async () => {
    let allPrefixesBusy = false
    const f = fixture({
        listHistory({ prefix, cursor }) {
            if (allPrefixesBusy || prefix === 'assets/ff') {
                const page = String(Number(cursor ?? 0) + 1)
                return {
                    objects: [{ key: prefix + page.padStart(62, '0') + '.webp' }],
                    truncated: true,
                    cursor: page,
                }
            }
        },
    })
    const items = Array.from({ length: 505 }, (_, index) => ({ id: 'screen-' + index }))
    for (const { id } of items) f.seed({ screenId: id, locale: 'en', separateThumbnail: true })
    const body = { ...input, flows: [{ title: 'Catalogue screens', items }] }
    const first = await f.request('/v1/flow-pages', { body })
    assert.equal(first.status, 201)
    const expectedHeads = [...f.objects.keys()].filter((key) => key.startsWith('assets/ff')).length
    assert.ok(expectedHeads > 0)
    assert.equal(f.assetChecks().headCount, expectedHeads)
    assert.ok(f.assetChecks().peakHeads <= 6)

    allPrefixesBusy = true
    const listingsBefore = f.assetListings()
    const overBudget = await f.request('/v1/flow-pages', { body })
    assert.equal(overBudget.status, 503)
    assert.match((await overBudget.json()).error, /storage request budget.*split the flow page/)
    assert.ok(f.assetListings() - listingsBefore <= 512)
    assert.equal(f.assetChecks().headCount, expectedHeads)
    assert.equal(f.manifestCount(), 1)
})
