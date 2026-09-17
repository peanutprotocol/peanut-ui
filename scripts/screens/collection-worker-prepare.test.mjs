import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectionWorkerConfiguration, prepareCollectionWorker } from './collection-worker/prepare.mjs'

const collectionWorkerEnv = {
    SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
    SCREEN_LIBRARY_R2_JURISDICTION: 'eu',
    SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
    SCREEN_LIBRARY_COLLECTION_API_URL: 'https://screen-collections.peanut.me',
    SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
}

test('collection API uses only an Access-protected custom domain', () => {
    const config = collectionWorkerConfiguration(collectionWorkerEnv)
    assert.equal(config.workers_dev, false)
    assert.equal(config.preview_urls, false)
    assert.equal(config.vars.SCREEN_LIBRARY_ACCESS_AUD, 'screen-library-access')
    assert.deepEqual(config.routes, [{ pattern: 'screen-collections.peanut.me', custom_domain: true }])
})

test('collection Worker preparation emits the access helper beside the generated entry point', () => {
    const target = mkdtempSync(join(tmpdir(), 'screen-collection-worker-'))
    try {
        prepareCollectionWorker(target, collectionWorkerEnv)
        assert.equal(existsSync(join(target, 'access.mjs')), true)
        assert.equal(existsSync(join(target, 'collection-worker', 'index.mjs')), true)
        assert.match(readFileSync(join(target, 'collection-worker', 'index.mjs'), 'utf8'), /\.\.\/access\.mjs/)
    } finally {
        rmSync(target, { recursive: true, force: true })
    }
})

test('collection API refuses an alternate public workers.dev origin', () => {
    assert.throws(
        () =>
            collectionWorkerConfiguration({
                SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
                SCREEN_LIBRARY_COLLECTION_API_URL: 'https://collections.example.workers.dev',
                SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
            }),
        /custom HTTPS origin/
    )
})
