import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from './worker/index.mjs'
const request = (path, method = 'GET') => new Request(`https://screens.example.com${path}`, { method })
test('worker exposes only protected gallery objects and supports read methods', async () => {
    let reads = 0
    const env = {
        REPORTS: {
            get: async () => {
                reads++
                return { body: '{}', httpEtag: '"x"' }
            },
            head: async () => ({ httpEtag: '"x"' }),
        },
    }
    for (const path of [
        '/screen-data/entries/private.json',
        '/screen-data/assets/a.png',
        `/screen-data/assets/${'a'.repeat(64)}.jpg`,
        '/screen-data/secrets',
        '/other',
    ])
        assert.equal((await worker.fetch(request(path), env)).status, 404)
    assert.equal(reads, 0)
    assert.equal((await worker.fetch(request('/screen-data/index.json', 'POST'), env)).status, 405)
    const index = await worker.fetch(request('/screen-data/index.json'), env)
    assert.equal(index.headers.get('cache-control'), 'private, max-age=60')
    const report = await worker.fetch(request('/screen-data/reports/2026-09-11/dev-abc/manifest.json'), env)
    assert.equal(report.headers.get('cache-control'), 'private, max-age=60')
    const collection = await worker.fetch(
        request('/screen-data/collections/choice-overload-20260916-abc/manifest.json'),
        env
    )
    assert.equal(collection.headers.get('cache-control'), 'private, max-age=10')
    const archive = await worker.fetch(request('/screen-data/reports/2026-09-11/dev-abc/offline.tar.gz'), env)
    assert.match(archive.headers.get('cache-control'), /immutable/)
    const asset = await worker.fetch(request(`/screen-data/assets/${'a'.repeat(64)}.png`), env)
    assert.equal(asset.headers.get('content-type'), 'image/png')
    assert.equal(asset.headers.get('cache-control'), 'private, max-age=31536000, immutable')
    const head = await worker.fetch(request('/screen-data/index.json', 'HEAD'), env)
    assert.equal(await head.text(), '')
})
test('missing or failed storage never returns the gallery HTML', async () => {
    assert.equal(
        (
            await worker.fetch(request('/screen-data/latest.json'), {
                REPORTS: { get: async () => null },
            })
        ).status,
        404
    )
    const failed = await worker.fetch(request('/screen-data/latest.json'), {
        REPORTS: {
            get: async () => {
                throw new Error('secret')
            },
        },
    })
    assert.equal(failed.status, 503)
    assert.equal(await failed.text(), 'Report storage unavailable')
})
