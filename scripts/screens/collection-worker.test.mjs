import test from 'node:test'
import assert from 'node:assert/strict'
import worker from './collection-worker/index.mjs'

const sha = 'a'.repeat(40)
const image = 'b'.repeat(64) + '.webp'
function bucket() {
    const objects = new Map([
        [
            'index.json',
            JSON.stringify([
                {
                    path: `2026-09-16/dev/en/${sha}/run-1-1`,
                    locale: 'en',
                    source: 'synthetic',
                    reportType: 'capture',
                    branch: 'dev',
                    complete: true,
                },
            ]),
        ],
        [
            `reports/2026-09-16/dev/en/${sha}/run-1-1/manifest.json`,
            JSON.stringify({
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: sha,
                screens: [
                    { id: 'profile', name: 'Profile', flow: 'Profile', kind: 'route', status: 'captured', image },
                ],
            }),
        ],
    ])
    return {
        objects,
        async get(key) {
            const value = objects.get(key)
            return value === undefined ? null : { json: async () => JSON.parse(value) }
        },
        async head(key) {
            return objects.has(key) ? {} : null
        },
        async put(key, value) {
            objects.set(key, String(value))
        },
    }
}
const accessHeaders = {
    'Cf-Access-Authenticated-User-Email': 'reviewer@peanut.me',
    'Cf-Access-Jwt-Assertion': 'verified-by-access',
}

test('collection API requires Access identity or the private service token', async () => {
    const env = { REPORTS: bucket(), COLLECTION_SERVICE_TOKEN: 'secret' }
    assert.equal((await worker.fetch(new Request('https://api.example/v1/screens'), env)).status, 401)
    assert.equal(
        (
            await worker.fetch(
                new Request('https://api.example/v1/screens', { headers: { Authorization: 'Bearer secret' } }),
                env
            )
        ).status,
        200
    )
})

test('collection API searches screens and creates an ordered reusable collection', async () => {
    const REPORTS = bucket()
    const env = { REPORTS, SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me' }
    const search = await worker.fetch(
        new Request('https://api.example/v1/screens?q=prof', { headers: accessHeaders }),
        env
    )
    assert.equal((await search.json()).screens[0].id, 'profile')
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { ...accessHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Choice overload', items: [{ id: 'profile', note: 'Flat menu' }] }),
        }),
        env
    )
    assert.equal(created.status, 201)
    const body = await created.json()
    assert.equal(body.collection.complete, true)
    assert.equal(body.collection.items[0].note, 'Flat menu')
    assert.match(body.url, /^https:\/\/screens\.peanut\.me\/collections\//)
    assert.ok(REPORTS.objects.has(`collections/${body.collection.id}/manifest.json`))
})
