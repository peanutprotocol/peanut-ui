import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
                    sequence: 1,
                },
                {
                    path: `2026-09-16/main/en/${sha}/run-2-1`,
                    locale: 'en',
                    source: 'synthetic',
                    reportType: 'capture',
                    branch: 'main',
                    complete: true,
                    sequence: 2,
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
                    {
                        id: 'profile',
                        name: 'Profile',
                        flow: 'Profile',
                        kind: 'route',
                        status: 'captured',
                        image,
                    },
                ],
            }),
        ],
        [
            `reports/2026-09-16/main/en/${sha}/run-2-1/manifest.json`,
            JSON.stringify({
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: sha,
                screens: [
                    {
                        id: 'profile',
                        name: 'Historical main profile',
                        flow: 'Profile',
                        kind: 'route',
                        status: 'captured',
                        image,
                    },
                ],
            }),
        ],
    ])
    const etag = (value) => `"${createHash('sha256').update(String(value)).digest('hex')}"`
    const storage = {
        objects,
        beforeConditionalPut: null,
        async get(key) {
            const value = objects.get(key)
            return value === undefined ? null : { json: async () => JSON.parse(value), httpEtag: etag(value) }
        },
        async head(key) {
            return objects.has(key) ? {} : null
        },
        async put(key, value, options = {}) {
            if (options.onlyIf?.etagMatches) {
                await storage.beforeConditionalPut?.({ key, options })
                if (etag(objects.get(key)) !== options.onlyIf.etagMatches) return null
            }
            objects.set(key, String(value))
            return { httpEtag: etag(value) }
        },
    }
    return storage
}
const accessContext = {
    access: {
        aud: 'screen-library-access',
        async getIdentity() {
            return { email: 'reviewer@peanut.me' }
        },
    },
}

test('collection API requires Access identity or the private service token', async () => {
    const env = { REPORTS: bucket(), COLLECTION_SERVICE_TOKEN: 'secret' }
    assert.equal((await worker.fetch(new Request('https://api.example/v1/screens'), env)).status, 401)
    assert.equal(
        (
            await worker.fetch(
                new Request('https://api.example/v1/screens', {
                    headers: { Authorization: 'Bearer secret' },
                }),
                env
            )
        ).status,
        200
    )
})

test('collection API searches screens and creates an ordered reusable collection', async () => {
    const REPORTS = bucket()
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
    }
    const search = await worker.fetch(new Request('https://api.example/v1/screens?q=prof'), env, accessContext)
    const searchBody = await search.json()
    assert.equal(searchBody.screens[0].id, 'profile')
    assert.match(searchBody.source, /\/dev\//)
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Choice overload',
                items: [{ id: 'profile', note: 'Flat menu' }],
            }),
        }),
        env,
        accessContext
    )
    assert.equal(created.status, 201)
    const body = await created.json()
    assert.equal(body.collection.complete, true)
    assert.equal(body.collection.createdBy, undefined)
    assert.equal(body.collection.items[0].note, 'Flat menu')
    assert.match(body.url, /^https:\/\/screens\.peanut\.me\/collections\//)
    assert.ok(REPORTS.objects.has(`collections/${body.collection.id}/manifest.json`))
    assert.deepEqual(JSON.parse(REPORTS.objects.get(`collection-audit/${body.collection.id}.json`)), {
        id: body.collection.id,
        createdAt: body.collection.createdAt,
        createdBy: 'reviewer@peanut.me',
    })
})

test('captureMissing queues the exact missing matrix against the current dev revision', async () => {
    const REPORTS = bucket()
    const calls = []
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url, options = {}) => {
            calls.push({ url, options })
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            return new Response(null, { status: 204 })
        },
    }
    const response = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Missing state',
                items: [{ id: 'send' }],
                captureMissing: true,
            }),
        }),
        env,
        accessContext
    )
    assert.equal(response.status, 201)
    const { collection } = await response.json()
    assert.equal(collection.capture.status, 'queued')
    const request = JSON.parse(REPORTS.objects.get(`collection-requests/${collection.id}.json`))
    assert.equal(request.targetCommit, sha)
    assert.deepEqual(request.screens, { en: ['send'] })
    const stored = JSON.parse(REPORTS.objects.get(`collections/${collection.id}/manifest.json`))
    assert.equal(stored.capture.status, 'queued')
    assert.equal(calls.length, 2)
    assert.match(calls[1].url, /screen-library-collection\.yml\/dispatches$/)
    assert.deepEqual(JSON.parse(calls[1].options.body), {
        ref: 'dev',
        inputs: { collection_id: collection.id },
    })
})

test('a failed workflow dispatch leaves the collection retriable', async () => {
    const REPORTS = bucket()
    let failDispatch = true
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url) => {
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            if (failDispatch) return new Response(null, { status: 500 })
            return new Response(null, { status: 204 })
        },
    }
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Retry dispatch',
                items: [{ id: 'send' }],
                captureMissing: true,
            }),
        }),
        env,
        accessContext
    )
    assert.equal(created.status, 503)
    const failedResponse = await created.json()
    assert.match(failedResponse.url, /^https:\/\/screens\.peanut\.me\/collections\//)
    assert.equal(failedResponse.collection.capture.status, 'failed')
    const manifestKey = [...REPORTS.objects.keys()].find((key) => /^collections\/.+\/manifest\.json$/.test(key))
    const failed = JSON.parse(REPORTS.objects.get(manifestKey))
    assert.equal(failed.capture.status, 'failed')

    failDispatch = false
    const retried = await worker.fetch(
        new Request(`https://api.example/v1/collections/${failed.id}/capture`, {
            method: 'POST',
            headers: {},
        }),
        env,
        accessContext
    )
    assert.equal(retried.status, 202)
    assert.equal((await retried.json()).queued, true)
    assert.equal(JSON.parse(REPORTS.objects.get(manifestKey)).capture.status, 'queued')
})

test('an abandoned running capture gets a new retry attempt', async () => {
    const REPORTS = bucket()
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url) => {
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            return new Response(null, { status: 204 })
        },
    }
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Abandoned capture',
                items: [{ id: 'send' }],
            }),
        }),
        env,
        accessContext
    )
    const { collection } = await created.json()
    const key = `collections/${collection.id}/manifest.json`
    const stale = JSON.parse(REPORTS.objects.get(key))
    stale.capture = {
        status: 'running',
        targetCommit: sha,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        attempt: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }
    REPORTS.objects.set(key, JSON.stringify(stale))

    const retried = await worker.fetch(
        new Request(`https://api.example/v1/collections/${collection.id}/capture`, {
            method: 'POST',
        }),
        env,
        accessContext
    )
    assert.equal(retried.status, 202)
    const body = await retried.json()
    assert.equal(body.queued, true)
    assert.equal(body.collection.capture.status, 'queued')
    assert.notEqual(body.collection.capture.attempt, stale.capture.attempt)
    const request = JSON.parse(REPORTS.objects.get(`collection-requests/${collection.id}.json`))
    assert.equal(request.attempt, body.collection.capture.attempt)
})

test('an abandoned queued capture gets a new retry attempt', async () => {
    const REPORTS = bucket()
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url) => {
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            return new Response(null, { status: 204 })
        },
    }
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Abandoned queued capture',
                items: [{ id: 'send' }],
            }),
        }),
        env,
        accessContext
    )
    const { collection } = await created.json()
    const key = `collections/${collection.id}/manifest.json`
    const stale = JSON.parse(REPORTS.objects.get(key))
    stale.capture = {
        status: 'queued',
        targetCommit: sha,
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        attempt: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }
    REPORTS.objects.set(key, JSON.stringify(stale))

    const retried = await worker.fetch(
        new Request(`https://api.example/v1/collections/${collection.id}/capture`, {
            method: 'POST',
        }),
        env,
        accessContext
    )
    assert.equal(retried.status, 202)
    const body = await retried.json()
    assert.equal(body.queued, true)
    assert.equal(body.collection.capture.status, 'queued')
    assert.notEqual(body.collection.capture.attempt, stale.capture.attempt)
    const request = JSON.parse(REPORTS.objects.get(`collection-requests/${collection.id}.json`))
    assert.equal(request.attempt, body.collection.capture.attempt)
})

test('a stale retry loses an R2 conditional-write race without dispatching a duplicate workflow', async () => {
    const REPORTS = bucket()
    const calls = []
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url) => {
            calls.push(url)
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            return new Response(null, { status: 204 })
        },
    }
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Conditional retry',
                items: [{ id: 'send' }],
            }),
        }),
        env,
        accessContext
    )
    const { collection } = await created.json()
    const key = `collections/${collection.id}/manifest.json`
    const stale = JSON.parse(REPORTS.objects.get(key))
    stale.capture = {
        status: 'queued',
        requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        attempt: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }
    REPORTS.objects.set(key, JSON.stringify(stale))
    REPORTS.beforeConditionalPut = ({ key: attemptedKey }) => {
        if (attemptedKey !== key) return
        const winner = JSON.parse(REPORTS.objects.get(key))
        winner.capture = {
            status: 'queued',
            requestedAt: new Date().toISOString(),
            attempt: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }
        REPORTS.objects.set(key, JSON.stringify(winner))
    }

    const response = await worker.fetch(
        new Request(`https://api.example/v1/collections/${collection.id}/capture`, {
            method: 'POST',
        }),
        env,
        accessContext
    )
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.queued, false)
    assert.equal(body.collection.capture.attempt, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    assert.deepEqual(calls, [])
})

test('a queue race never rolls the winning capture attempt back to failed', async () => {
    const REPORTS = bucket()
    const calls = []
    const env = {
        REPORTS,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
        GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
        GITHUB_ACTIONS_TOKEN: 'github-token',
        GITHUB_FETCH: async (url) => {
            calls.push(url)
            if (url.endsWith('/git/ref/heads/dev')) return Response.json({ object: { sha } })
            return new Response(null, { status: 204 })
        },
    }
    const created = await worker.fetch(
        new Request('https://api.example/v1/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Queue race',
                items: [{ id: 'send' }],
            }),
        }),
        env,
        accessContext
    )
    const { collection } = await created.json()
    const key = `collections/${collection.id}/manifest.json`
    const winnerAttempt = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    REPORTS.beforeConditionalPut = ({ key: attemptedKey }) => {
        if (attemptedKey !== key) return
        const winner = JSON.parse(REPORTS.objects.get(key))
        winner.capture = {
            status: 'queued',
            targetCommit: sha,
            requestedAt: new Date().toISOString(),
            attempt: winnerAttempt,
        }
        REPORTS.objects.set(key, JSON.stringify(winner))
    }

    const response = await worker.fetch(
        new Request(`https://api.example/v1/collections/${collection.id}/capture`, {
            method: 'POST',
        }),
        env,
        accessContext
    )
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.queued, false)
    assert.equal(body.collection.capture.attempt, winnerAttempt)
    assert.equal(JSON.parse(REPORTS.objects.get(key)).capture.attempt, winnerAttempt)
    assert.deepEqual(calls, [`https://api.github.com/repos/peanutprotocol/peanut-ui/git/ref/heads/dev`])
})
