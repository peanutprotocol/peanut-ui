import test from 'node:test'
import assert from 'node:assert/strict'
import { composeCollection } from './collection-core.mjs'
import { prepareCollectionCapture, validateCollectionRequest } from './collection-request.mjs'

const collectionId = 'choice-overload-20260916-abc123'
const targetCommit = 'b'.repeat(40)

function missingCollection() {
    return composeCollection({
        id: collectionId,
        spec: { title: 'Choice overload', items: [{ id: 'profile' }] },
        reports: {
            en: {
                schema: 1,
                type: 'capture',
                locale: 'en',
                commit: 'a'.repeat(40),
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
}

function memoryStorage(collection, screens = { en: ['profile'] }) {
    const objects = new Map([
        [`collections/${collectionId}/manifest.json`, Buffer.from(JSON.stringify(collection))],
        [
            `collection-requests/${collectionId}.json`,
            Buffer.from(JSON.stringify({ schema: 1, collectionId, targetCommit, screens })),
        ],
    ])
    return {
        objects,
        async read(key) {
            const value = objects.get(key)
            if (!value) throw new Error('missing')
            return value
        },
        async put(key, value) {
            objects.set(key, Buffer.from(value))
        },
    }
}

test('focused capture requests contain only bounded safe screen IDs and locales', () => {
    const request = validateCollectionRequest(
        {
            schema: 1,
            collectionId,
            targetCommit: 'a'.repeat(40),
            screens: { en: ['profile', 'send'], 'pt-BR': ['send'] },
        },
        collectionId
    )
    assert.deepEqual(request.screens.en, ['profile', 'send'])
    assert.throws(
        () =>
            validateCollectionRequest(
                {
                    schema: 1,
                    collectionId,
                    targetCommit: 'a'.repeat(40),
                    screens: { en: ['../secret'] },
                },
                collectionId
            ),
        /screen ID/
    )
})

test('preparing focused capture marks the collection running and returns the exact matrix', async () => {
    const storage = memoryStorage(missingCollection())
    const prepared = await prepareCollectionCapture(collectionId, storage)
    assert.equal(prepared.targetCommit, targetCommit)
    assert.deepEqual(prepared.matrix, [{ locale: 'en', only: 'profile' }])
    const stored = JSON.parse(storage.objects.get(`collections/${collectionId}/manifest.json`))
    assert.equal(stored.capture.status, 'running')
    assert.match(stored.capture.startedAt, /^2026-/)
})

test('preparing focused capture rejects screens that are not real collection gaps', async () => {
    const storage = memoryStorage(missingCollection(), { en: ['send'] })
    await assert.rejects(() => prepareCollectionCapture(collectionId, storage), /does not match collection gaps/)
    const stored = JSON.parse(storage.objects.get(`collections/${collectionId}/manifest.json`))
    assert.equal(stored.capture.status, 'not-requested')
})
