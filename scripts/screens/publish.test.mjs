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
    }
}

function capture(image, locale = 'en') {
    return {
        schema: 1,
        type: 'capture',
        commit,
        locale,
        contentCommit: 'b'.repeat(40),
        harness: 'c'.repeat(64),
        fixtures: 'd'.repeat(64),
        environment: 'test',
        adapter: 'v1',
        capturedAt: '2026-09-11T00:00:00Z',
        profile: `${locale}-393x852`,
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
        const manifest = JSON.parse(
            storage.objects.get(`reports/2026-09-11/dev-${commit}/run-123-1/manifest.json`).toString()
        )
        assert.equal(manifest.previewUrls, undefined)
        assert.equal(manifest.originalUrls, undefined)
        assert.ok(storage.objects.has(`assets/${name}`))
        assert.ok(storage.calls.indexOf(`assets/${name}`) < entryIndex)
        assert.equal(hash(PNG.sync.write(image)), name.split('.')[0])
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('publication accepts locale-scoped dev paths and records the locale', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-publish-locale-test-'))
    try {
        const assets = join(dir, 'assets')
        mkdirSync(assets)
        const image = new PNG({ width: 393, height: 852 })
        image.data.fill(127)
        const name = storeAsset(assets, PNG.sync.write(image))
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify(capture(name, 'pt-BR')))
        const storage = memoryStorage()
        await publishReport({
            inputDir: dir,
            reportPath: `2026-09-11/dev/pt-br/${commit}/run-123-1`,
            env: {
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example',
                DEV_SEQUENCE: '123',
                RUN_ATTEMPT: '1',
                CAPTURE_ATTEMPT: '1',
            },
            storage,
        })
        const entryPath = storage.calls.find((pathname) => pathname.startsWith('entries/'))
        assert.equal(JSON.parse(storage.objects.get(entryPath).toString()).locale, 'pt-BR')
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('publication accepts sanitized Nutcracker journeys without changing the synthetic latest pointer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-publish-nutcracker-test-'))
    try {
        const assets = join(dir, 'assets')
        mkdirSync(assets)
        // Nutcracker captures full pages. At the exporter's 197px thumbnail
        // width, this produces a 197x1970 WebP: valid for journeys, but larger
        // than the synthetic capture decoder ceiling.
        const original = new PNG({ width: 240, height: 2400 })
        original.data.fill(127)
        const originalName = storeAsset(assets, PNG.sync.write(original))
        const { default: sharp } = await import('sharp')
        const thumbnailBytes = await sharp(PNG.sync.write(original)).resize({ width: 197 }).webp().toBuffer()
        const thumbnailName = storeAsset(assets, thumbnailBytes, 'webp')
        const report = {
            schema: 1,
            type: 'journeys',
            source: 'nutcracker',
            commit,
            uiCommit: 'b'.repeat(40),
            apiCommit: 'c'.repeat(40),
            locale: 'en',
            environment: 'sandbox',
            capturedAt: '2026-09-14T00:00:00Z',
            profile: 'en-iphone-14',
            width: 390,
            height: 664,
            attemptedSteps: 1,
            failedSteps: 0,
            omittedFailedSteps: 0,
            complete: true,
            screens: [
                {
                    id: 'send-success',
                    name: 'Send success',
                    flow: 'e2e-send',
                    kind: 'route',
                    route: '/send/success',
                    trustTier: 'full-e2e',
                    status: 'passed',
                    image: originalName,
                    thumbnail: thumbnailName,
                },
            ],
        }
        writeFileSync(join(dir, 'manifest.json'), JSON.stringify(report))
        const storage = memoryStorage()
        await publishReport({
            inputDir: dir,
            reportPath: `2026-09-14/nutcracker/en/${commit}/run-123-1`,
            env: {
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example',
                EXPECTED_HEAD: commit,
                DEV_SEQUENCE: '123',
                RUN_ATTEMPT: '1',
            },
            storage,
        })
        const entryPath = storage.calls.find((pathname) => pathname.startsWith('entries/'))
        const entry = JSON.parse(storage.objects.get(entryPath).toString())
        assert.equal(entry.source, 'nutcracker')
        assert.equal(entry.label, `Nutcracker · ${commit.slice(0, 8)}`)
        assert.equal(storage.objects.has('latest.json'), false)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
