import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, identity } from './flow-page-fixture.mjs'

const sections = [
    {
        title: 'First',
        flows: [{ title: 'Start', items: [{ id: 'screen-a', note: 'First note' }, { id: 'screen-b' }] }],
    },
    {
        title: 'Second',
        flows: [
            {
                title: 'Return',
                items: [
                    { id: 'screen-a', note: 'Return note' },
                    { id: 'screen-a', note: 'Again' },
                ],
            },
        ],
    },
]
const payload = { title: 'Sectioned page', sections }

function seedComparison(f, { locale = 'en', trusted = true, mismatch = false, profileMismatch = false } = {}) {
    const index = JSON.parse(f.objects.get('index.json').body)
    const capture = index.find((entry) => entry.locale === locale && entry.reportType === 'capture')
    const key = `reports/${capture.path}/manifest.json`
    const selected = JSON.parse(f.objects.get(key).body)
    Object.assign(selected, { profile: `${locale}-393x852`, width: 393, height: 852 })
    f.objects.set(key, { body: JSON.stringify(selected) })
    const afterCommit = mismatch ? 'f'.repeat(40) : selected.commit
    const beforeCommit = 'c'.repeat(40)
    const path = `2026-11-07/pr-3987/${locale.toLowerCase()}/${afterCommit}/run-2-1`
    index.push({
        path,
        locale,
        source: 'synthetic',
        reportType: 'comparison',
        prNumber: 3987,
        ...(trusted ? { releasePreview: true } : {}),
        profile: '393x852',
        complete: true,
        sequence: 2,
    })
    f.objects.set('index.json', { body: JSON.stringify(index) })
    const before = { commit: beforeCommit, locale, profile: `${locale}-393x852`, width: 393, height: 852 }
    const after = {
        ...selected,
        commit: afterCommit,
        ...(profileMismatch ? { profile: `${locale}-360x800`, width: 360, height: 800 } : {}),
    }
    const screens = selected.screens.map((screen) => ({
        id: screen.id,
        status: 'changed',
        before: { status: 'captured', image: 'd'.repeat(64) + '.webp' },
        after: { status: 'captured', image: screen.image },
    }))
    f.objects.set(`reports/${path}/manifest.json`, {
        body: JSON.stringify({ schema: 1, type: 'comparison', locale, before, after, screens }),
    })
    return { path, baseBranch: 'main', beforeCommit, afterCommit }
}
function seedScreens(f) {
    f.seed({ screenId: 'screen-a', locale: 'en' })
    f.seed({ screenId: 'screen-b', locale: 'en' })
    return seedComparison(f)
}
async function create(f, body) {
    const response = await f.request('/v1/flow-pages', { body })
    const result = await response.json()
    assert.equal(response.status, 201, JSON.stringify(result))
    return result
}

test('discovery exposes sections and compareWith while retaining flows on both transports', async () => {
    const f = fixture()
    for (const modern of [true, false]) {
        const { envelope } = await f.call('tools/list', { modern })
        const schema = envelope.result.tools.find((entry) => entry.name === 'create_flow_page').inputSchema
        assert.ok(schema.properties.flows)
        assert.ok(schema.properties.sections)
        assert.ok(schema.properties.compareWith)
    }
})

test('ordered repeated placements and trusted main provenance are pinned and survive replay', async () => {
    const f = fixture()
    const comparison = seedScreens(f)
    const body = { ...payload, requestId: 'ordered-sections' }
    const created = await create(f, body)
    const page = await f.read(created.id)
    assert.deepEqual(page.sections, sections)
    assert.deepEqual(
        page.flows,
        sections.flatMap((section) => section.flows)
    )
    assert.deepEqual(
        page.items.map((item) => item.id),
        ['screen-a', 'screen-b']
    )
    assert.equal(page.compareWith, 'main')
    assert.deepEqual(page.comparisons, { en: comparison })
    const status = await f.call('tools/call', {
        params: { name: 'get_collection_status', arguments: { id: created.id } },
    })
    assert.ok(!status.envelope.result.isError, JSON.stringify(status.envelope))
    const statusBody = JSON.parse(status.envelope.result.content[0].text)
    assert.deepEqual(statusBody.collection.sections, sections)
    assert.deepEqual(statusBody.collection.comparisons, { en: comparison })
    const other = await f.request('/v1/flow-pages', { body, context: identity('other@peanut.me') })
    assert.equal(other.status, 201)
    assert.notEqual((await other.json()).id, created.id)
    f.seed({ screenId: 'screen-a', locale: 'en', sequence: 3 })
    f.objects.delete(`reports/${comparison.path}/manifest.json`)
    const replay = await f.request('/v1/flow-pages', { body })
    assert.equal(replay.status, 200)
    assert.equal((await replay.json()).id, created.id)
    assert.deepEqual((await f.read(created.id)).comparisons, { en: comparison })
})

test('reads reject inconsistent or incomplete section manifests', async () => {
    const f = fixture()
    seedScreens(f)
    const created = await create(f, payload)
    const key = `collections/${created.id}/manifest.json`
    const original = JSON.parse(f.objects.get(key).body)
    const invalid = [
        { ...original, flows: [...original.flows].reverse() },
        {
            ...original,
            sections: [{ title: 'Broken', flows: [{ title: 'Missing', items: [{ id: 'missing-screen' }] }] }],
        },
        { ...original, complete: false },
    ]
    for (const manifest of invalid) {
        f.objects.set(key, { body: JSON.stringify(manifest) })
        const response = await f.request(`/v1/collections/${created.id}`)
        assert.ok(!response.ok)
    }
    f.objects.set(key, { body: JSON.stringify(original) })
    assert.equal((await f.request(`/v1/collections/${created.id}`)).status, 200)
})

test('invalid hierarchy and injected pointers do not write', async () => {
    const f = fixture()
    seedScreens(f)
    const invalid = [
        { title: 'x' },
        { ...payload, flows: sections[0].flows },
        { ...payload, sections: [] },
        { ...payload, sections: [{ title: ' ', flows: sections[0].flows }] },
        { ...payload, sections: [{ title: 'x'.repeat(121), flows: sections[0].flows }] },
        { ...payload, sections: [{ title: 'x', flows: [] }] },
        { ...payload, sections: [{ title: 'x', flows: [{ title: 'x', items: [] }] }] },
        {
            ...payload,
            sections: [{ title: 'x', flows: [{ title: 'x', items: [{ id: 'screen-a', note: 'x'.repeat(1001) }] }] }],
        },
        { ...payload, sections: [{ ...sections[0], extra: true }] },
        { ...payload, compareWith: 'dev' },
        { ...payload, comparisons: { en: { path: 'injected' } } },
    ]
    for (const body of invalid) {
        assert.equal((await f.request('/v1/flow-pages', { body })).status, 400, JSON.stringify(body))
        assert.equal(f.manifestCount(), 0)
    }
})

test('missing, untrusted, mismatched commit or profile, and missing locale comparisons fail before writes', async () => {
    for (const condition of ['missing', 'untrusted', 'mismatch', 'profile', 'missing-locale']) {
        const f = fixture()
        f.seed({ screenId: 'screen-a', locale: 'en' })
        f.seed({ screenId: 'screen-b', locale: 'en' })
        if (condition !== 'missing')
            seedComparison(f, {
                trusted: condition !== 'untrusted',
                mismatch: condition === 'mismatch',
                profileMismatch: condition === 'profile',
            })
        if (condition === 'missing-locale') {
            f.seed({ screenId: 'screen-a', locale: 'es-419' })
            f.seed({ screenId: 'screen-b', locale: 'es-419' })
        }
        const response = await f.request('/v1/flow-pages', {
            body: { ...payload, ...(condition === 'missing-locale' ? { locales: ['en', 'es-419'] } : {}) },
        })
        assert.ok(!response.ok, condition)
        assert.equal(f.manifestCount(), 0, condition)
        assert.equal(f.counters().captures, 0, condition)
    }
})

test('same request id conflicts when hierarchy or placement notes change', async () => {
    const f = fixture()
    seedScreens(f)
    await create(f, { ...payload, requestId: 'hierarchy-conflict' })
    for (const changed of [
        [...sections].reverse(),
        [
            {
                ...sections[0],
                flows: [{ ...sections[0].flows[0], items: [{ id: 'screen-a', note: 'Changed' }, { id: 'screen-b' }] }],
            },
            sections[1],
        ],
    ]) {
        const response = await f.request('/v1/flow-pages', {
            body: { ...payload, sections: changed, requestId: 'hierarchy-conflict' },
        })
        assert.equal(response.status, 409)
        assert.equal(f.manifestCount(), 1)
    }
})

test('470 repeated placements survive both MCP transports and legacy flows retain their default', async () => {
    const f = fixture()
    f.seed({ screenId: 'screen-a', locale: 'en' })
    seedComparison(f)
    const many = Array.from({ length: 470 }, (_, i) => ({ id: 'screen-a', note: `Placement ${i}` }))
    const value = { title: 'Large page', sections: [{ title: 'All', flows: [{ title: 'Repeated', items: many }] }] }
    for (const modern of [true, false]) {
        const { envelope } = await f.call('tools/call', {
            modern,
            params: { name: 'create_flow_page', arguments: value },
        })
        assert.ok(!envelope.error && !envelope.result.isError, JSON.stringify(envelope))
        const page = await f.read(envelope.result.structuredContent.id)
        assert.deepEqual(page.sections, value.sections)
        assert.equal(page.items.length, 1)
    }
    const legacy = await create(f, { title: 'Legacy', flows: [{ title: 'Flow', items: [{ id: 'screen-a' }] }] })
    const page = await f.read(legacy.id)
    assert.equal(page.compareWith, undefined)
    assert.equal(page.comparisons, undefined)
})
