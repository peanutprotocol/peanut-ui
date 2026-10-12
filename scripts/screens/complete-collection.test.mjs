import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { completeCollection } from './complete-collection.mjs'
import { composeCollection } from './collection-core.mjs'
import { storeAsset } from './core.mjs'

const oldCommit = 'a'.repeat(40)
const targetCommit = 'b'.repeat(40)
const collectionId = 'choice-overload-20260916-abc123'

function memoryStorage(initial) {
    const objects = new Map(Object.entries(initial).map(([key, value]) => [key, Buffer.from(value)]))
    const etag = (value) => `"${createHash('sha256').update(value).digest('hex')}"`
    const storage = {
        objects,
        beforeConditionalPut: null,
        async read(key) {
            const value = objects.get(key)
            if (!value) throw new Error('missing')
            return value
        },
        async readWithMetadata(key) {
            const body = await storage.read(key)
            return { body, etag: etag(body) }
        },
        async put(key, value, options = {}) {
            if (options.ifMatch) {
                await storage.beforeConditionalPut?.({ key, options })
                const current = objects.get(key)
                if (!current || etag(current) !== options.ifMatch) throw new Error('Precondition failed')
            }
            if (!options.allowOverwrite && objects.has(key)) throw new Error('exists')
            objects.set(key, Buffer.isBuffer(value) ? value : Buffer.from(value))
        },
    }
    return storage
}

test('memory storage rejects a stale completion ETag', async () => {
    const storage = memoryStorage({ 'manifest.json': 'first' })
    const initial = await storage.readWithMetadata('manifest.json')
    storage.objects.set('manifest.json', Buffer.from('replacement'))
    await assert.rejects(
        () =>
            storage.put('manifest.json', 'stale completion', {
                allowOverwrite: true,
                ifMatch: initial.etag,
            }),
        /Precondition failed/
    )
})

test('focused completion publishes WebP only and fills the requested collection variant', async () => {
    const root = mkdtempSync(join(tmpdir(), 'complete-screen-collection-'))
    try {
        const captureDir = join(root, 'screen-collection-en')
        const assets = join(captureDir, 'assets')
        mkdirSync(assets, { recursive: true })
        const png = new PNG({ width: 393, height: 852 })
        png.data.fill(127)
        const image = storeAsset(assets, PNG.sync.write(png))
        writeFileSync(
            join(captureDir, 'capture.json'),
            JSON.stringify({
                schema: 1,
                type: 'capture',
                commit: targetCommit,
                locale: 'en',
                contentCommit: 'c'.repeat(40),
                harness: 'd'.repeat(64),
                fixtures: 'e'.repeat(64),
                environment: 'test',
                adapter: 'v1',
                capturedAt: '2026-09-16T12:00:00Z',
                profile: 'en-393x852',
                width: 393,
                height: 852,
                screens: [
                    {
                        id: 'profile',
                        name: 'Profile',
                        flow: 'Profile',
                        kind: 'route',
                        status: 'captured',
                        image,
                        thumbnail: image,
                    },
                ],
                inventory: [{ route: '/profile', status: 'catalogued', screens: ['profile'] }],
            })
        )
        const collection = composeCollection({
            id: collectionId,
            spec: { title: 'Choice overload', items: [{ id: 'profile' }] },
            reports: {
                en: {
                    schema: 1,
                    type: 'capture',
                    locale: 'en',
                    commit: oldCommit,
                    screens: [
                        {
                            id: 'profile',
                            name: 'Profile',
                            flow: 'Profile',
                            kind: 'route',
                            status: 'unavailable',
                            reason: 'Pending',
                        },
                    ],
                },
            },
            createdAt: '2026-09-16T10:00:00Z',
        })
        collection.capture = { status: 'running', targetCommit }
        const storage = memoryStorage({
            [`collections/${collectionId}/manifest.json`]: JSON.stringify(collection),
            [`collection-requests/${collectionId}.json`]: JSON.stringify({
                schema: 1,
                collectionId,
                targetCommit,
                screens: { en: ['profile'] },
            }),
        })
        const completed = await completeCollection({
            collectionId,
            inputDir: root,
            storage,
        })
        assert.equal(completed.complete, true)
        assert.equal(completed.capture.status, 'complete')
        assert.match(completed.items[0].variants.en.image, /^[a-f0-9]{64}\.webp$/)
        assert.equal(completed.items[0].variants.en.commit, targetCommit)
        assert.ok(storage.objects.has(`assets/${completed.items[0].variants.en.image}`))
        assert.equal(storage.objects.has(`assets/${image}`), false)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

test('focused completion persists a retriable partial collection when a locale artifact is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'partial-screen-collection-'))
    try {
        const collection = composeCollection({
            id: collectionId,
            spec: { title: 'Choice overload', items: [{ id: 'profile' }] },
            reports: {
                en: {
                    schema: 1,
                    type: 'capture',
                    locale: 'en',
                    commit: oldCommit,
                    screens: [
                        {
                            id: 'profile',
                            name: 'Profile',
                            flow: 'Profile',
                            kind: 'route',
                            status: 'unavailable',
                            reason: 'Pending',
                        },
                    ],
                },
            },
            createdAt: '2026-09-16T10:00:00Z',
        })
        collection.capture = { status: 'running', targetCommit }
        const storage = memoryStorage({
            [`collections/${collectionId}/manifest.json`]: JSON.stringify(collection),
            [`collection-requests/${collectionId}.json`]: JSON.stringify({
                schema: 1,
                collectionId,
                targetCommit,
                screens: { en: ['profile'] },
            }),
        })
        await assert.rejects(
            () => completeCollection({ collectionId, inputDir: root, storage }),
            /1 collection variants could not be captured/
        )
        const stored = JSON.parse(storage.objects.get(`collections/${collectionId}/manifest.json`))
        assert.equal(stored.capture.status, 'partial')
        assert.deepEqual(stored.capture.failedLocales, ['en'])
        assert.match(stored.capture.finishedAt, /^2026-/)
        assert.equal(stored.missing.length, 1)
        assert.equal(JSON.parse(storage.objects.get(`collection-entries/${collectionId}.json`)).complete, false)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})

test('a late completion cannot overwrite a newer capture attempt', async () => {
    const collection = composeCollection({
        id: collectionId,
        spec: { title: 'Choice overload', items: [{ id: 'profile' }] },
        reports: {
            en: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: oldCommit,
                screens: [
                    {
                        id: 'profile',
                        name: 'Profile',
                        flow: 'Profile',
                        kind: 'route',
                        status: 'unavailable',
                    },
                ],
            },
        },
        createdAt: '2026-09-16T10:00:00Z',
    })
    collection.capture = {
        status: 'running',
        targetCommit,
        attempt: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }
    const storage = memoryStorage({
        [`collections/${collectionId}/manifest.json`]: JSON.stringify(collection),
        [`collection-requests/${collectionId}.json`]: JSON.stringify({
            schema: 1,
            collectionId,
            attempt: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            targetCommit,
            screens: { en: ['profile'] },
        }),
    })
    await assert.rejects(
        () => completeCollection({ collectionId, inputDir: tmpdir(), storage }),
        /Capture attempt is no longer current/
    )
})

test('a capture attempt replaced during conversion cannot be committed', async () => {
    const initialAttempt = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const replacementAttempt = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const collection = composeCollection({
        id: collectionId,
        spec: { title: 'Choice overload', items: [{ id: 'profile' }] },
        reports: {
            en: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: oldCommit,
                screens: [],
            },
        },
        createdAt: '2026-09-16T10:00:00Z',
    })
    collection.capture = { status: 'running', targetCommit, attempt: initialAttempt }
    const requestKey = `collection-requests/${collectionId}.json`
    const manifestKey = `collections/${collectionId}/manifest.json`
    const storage = memoryStorage({
        [manifestKey]: JSON.stringify(collection),
        [requestKey]: JSON.stringify({
            schema: 1,
            collectionId,
            attempt: initialAttempt,
            targetCommit,
            screens: { en: ['profile'] },
        }),
    })
    storage.beforeConditionalPut = async ({ key }) => {
        if (key !== manifestKey) return
        const replacement = JSON.parse(storage.objects.get(manifestKey))
        replacement.capture = { ...replacement.capture, status: 'running', attempt: replacementAttempt }
        storage.objects.set(manifestKey, Buffer.from(JSON.stringify(replacement)))
        const replacementRequest = JSON.parse(storage.objects.get(requestKey))
        replacementRequest.attempt = replacementAttempt
        storage.objects.set(requestKey, Buffer.from(JSON.stringify(replacementRequest)))
    }

    await assert.rejects(
        () => completeCollection({ collectionId, inputDir: tmpdir(), storage, attempt: initialAttempt }),
        /Precondition failed/
    )
    const stored = JSON.parse(storage.objects.get(manifestKey))
    assert.equal(stored.capture.attempt, replacementAttempt)
    assert.equal(stored.capture.status, 'running')
    assert.equal(JSON.parse(storage.objects.get(requestKey)).attempt, replacementAttempt)
    assert.equal(storage.objects.has(`collection-entries/${collectionId}.json`), false)
})
