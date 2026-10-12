import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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

// wrangler bundles only what prepare copies, so a new relative import in a copied module
// fails the deploy on dev and nowhere earlier (capture-profiles.mjs, 2026-09-23).
test('every relative import in the prepared collection Worker resolves to a copied file', () => {
    const target = mkdtempSync(join(tmpdir(), 'screen-collection-worker-'))
    try {
        prepareCollectionWorker(target, collectionWorkerEnv)
        const modules = readdirSync(target, { recursive: true }).filter((file) => file.endsWith('.mjs'))
        for (const module of modules) {
            const source = readFileSync(join(target, module), 'utf8')
            for (const [, specifier] of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g))
                assert.equal(
                    existsSync(join(target, dirname(module), specifier)),
                    true,
                    `${module} imports ${specifier}`
                )
        }
    } finally {
        rmSync(target, { recursive: true, force: true })
    }
})

test('collection API supports an Access-protected workers.dev deployment', () => {
    const config = collectionWorkerConfiguration({
        SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
        SCREEN_LIBRARY_PUBLIC_URL: 'https://peanut-screen-library.example.workers.dev',
        SCREEN_LIBRARY_COLLECTION_API_URL: 'https://peanut-screen-library-collections.example.workers.dev',
        SCREEN_LIBRARY_ACCESS_AUD: 'screen-library-access',
    })
    assert.equal(config.workers_dev, true)
    assert.equal(config.preview_urls, false)
    assert.equal(config.routes, undefined)
    assert.equal(config.vars.SCREEN_LIBRARY_PUBLIC_URL, 'https://peanut-screen-library.example.workers.dev')
})
