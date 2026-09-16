import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCollectionRequest } from './collection-request.mjs'

test('focused capture requests contain only bounded safe screen IDs and locales', () => {
    const id = 'choice-overload-20260916-abc123'
    const request = validateCollectionRequest(
        {
            schema: 1,
            collectionId: id,
            targetCommit: 'a'.repeat(40),
            screens: { en: ['profile', 'send'], 'pt-BR': ['send'] },
        },
        id
    )
    assert.deepEqual(request.screens.en, ['profile', 'send'])
    assert.throws(
        () =>
            validateCollectionRequest(
                { schema: 1, collectionId: id, targetCommit: 'a'.repeat(40), screens: { en: ['../secret'] } },
                id
            ),
        /screen ID/
    )
})
