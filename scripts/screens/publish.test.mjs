import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'
import { hash, storeAsset } from './core.mjs'
import { publishReport } from './publish.mjs'

const commit = 'a'.repeat(40)

function memoryStorage() {
    const objects = new Map()
    const calls = []
    return {
        objects,
        calls,
        async put(pathname, body, options = {}) {
            calls.push(pathname)
            if (!options.allowOverwrite && objects.has(pathname)) throw new Error('already exists')
            objects.set(pathname, Buffer.isBuffer(body) ? body : Buffer.from(body))
            return { pathname, url: `https://screens.example/screen-data/${pathname}` }
        },
        async list({ prefix }) {
            return {
                blobs: [...objects.keys()]
                    .filter((pathname) => pathname.startsWith(prefix))
                    .map((pathname) => ({ pathname })),
                hasMore: false,
            }
        },
        async read(pathname) {
            return objects.get(pathname)
        },
        async preview(name) {
            return `https://imagedelivery.net/hash/peanut-screen-${name.split('.')[0]}/screenpreview`
        },
    }
}

function capture(image) {
    return {
        schema: 1,
        type: 'capture',
        commit,
        contentCommit: 'b'.repeat(40),
        harness: 'c'.repeat(64),
        fixtures: 'd'.repeat(64),
        environment: 'test',
        adapter: 'v1',
        capturedAt: '2026-09-11T00:00:00Z',
        profile: 'en-393x852',
        width: 393,
        height: 852,
        screens: [
            { id: 'home', name: 'Home', flow: 'Home', kind: 'route', status: 'captured', image, thumbnail: image },
        ],
        inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
    }
}

test('publication writes the entry commit marker before shared pointers', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-publish-test-'))
    try {
        const assets = join(dir, 'assets')
        mkdirSync(assets)
        const image = new PNG({ width: 393, height: 852 })
        image.data.fill(127)
        const name = storeAsset(assets, PNG.sync.write(image))
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify(capture(name)))
        const storage = memoryStorage()
        await publishReport({
            inputDir: dir,
            reportPath: `2026-09-11/dev-${commit}/run-123-1`,
            env: {
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example',
                DEV_SEQUENCE: '123',
                RUN_ATTEMPT: '1',
                CAPTURE_ATTEMPT: '1',
            },
            storage,
        })
        const entryIndex = storage.calls.findIndex((pathname) => pathname.startsWith('entries/'))
        assert.ok(entryIndex >= 0)
        assert.ok(storage.calls.indexOf('index.json') > entryIndex)
        assert.ok(storage.calls.indexOf('latest.json') > entryIndex)
        assert.equal(JSON.parse(storage.objects.get(storage.calls[entryIndex]).toString()).captureAttempt, 1)
        assert.equal(hash(PNG.sync.write(image)), name.split('.')[0])
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
