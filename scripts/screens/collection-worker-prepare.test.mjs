import test from 'node:test'
import assert from 'node:assert/strict'
import { collectionWorkerConfiguration } from './collection-worker/prepare.mjs'

test('collection API uses only an Access-protected custom domain', () => {
    const config = collectionWorkerConfiguration({
        SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
        SCREEN_LIBRARY_R2_JURISDICTION: 'eu',
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
        SCREEN_LIBRARY_COLLECTION_API_URL: 'https://screen-collections.peanut.me',
    })
    assert.equal(config.workers_dev, false)
    assert.equal(config.preview_urls, false)
    assert.deepEqual(config.routes, [{ pattern: 'screen-collections.peanut.me', custom_domain: true }])
})

test('collection API refuses an alternate public workers.dev origin', () => {
    assert.throws(
        () =>
            collectionWorkerConfiguration({
                SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
                SCREEN_LIBRARY_COLLECTION_API_URL: 'https://collections.example.workers.dev',
            }),
        /custom HTTPS origin/
    )
})
