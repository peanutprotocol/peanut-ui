import test from 'node:test'
import assert from 'node:assert/strict'
import { workerConfiguration } from './worker/prepare.mjs'

const base = {
    SCREEN_LIBRARY_R2_BUCKET: 'screens-library',
    SCREEN_LIBRARY_R2_JURISDICTION: 'eu',
}

test('custom-domain deployments disable alternate workers.dev and preview URLs', () => {
    const configuration = workerConfiguration({
        ...base,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.peanut.me',
    })
    assert.equal(configuration.workers_dev, false)
    assert.equal(configuration.preview_urls, false)
    assert.deepEqual(configuration.routes, [{ pattern: 'screens.peanut.me', custom_domain: true }])
})

test('workers.dev deployments retain only their configured production hostname', () => {
    const configuration = workerConfiguration({
        ...base,
        SCREEN_LIBRARY_PUBLIC_URL: 'https://peanut-screen-library.peanut-screens.workers.dev',
    })
    assert.equal(configuration.workers_dev, true)
    assert.equal(configuration.preview_urls, false)
    assert.equal(configuration.routes, undefined)
})
