import test from 'node:test'
import assert from 'node:assert/strict'
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
    return {
        objects,
        async read(key) {
            const value = objects.get(key)
            if (!value) throw new Error('missing')
            return value
        },
        async put(key, value, options = {}) {
            if (!options.allowOverwrite && objects.has(key)) throw new Error('exists')
            objects.set(key, Buffer.isBuffer(value) ? value : Buffer.from(value))
        },
    }
}

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
        const completed = await completeCollection({ collectionId, inputDir: root, storage })
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
