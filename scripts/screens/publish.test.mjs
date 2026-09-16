import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
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

function capture(image, locale = 'en', captureCommit = commit) {
    return {
        schema: 1,
        type: 'capture',
        commit: captureCommit,
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
        const sourceBytes = PNG.sync.write(image)
        const name = storeAsset(assets, sourceBytes)
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
                SOURCE_BRANCH: 'dev',
                PR_NUMBER: '3166',
                CHANGED_SCREENS: '4',
            },
            storage,
        })
        const entryIndex = storage.calls.findIndex((pathname) => pathname.startsWith('entries/'))
        assert.ok(entryIndex >= 0)
        assert.ok(storage.calls.indexOf('index.json') > entryIndex)
        assert.ok(storage.calls.indexOf('latest.json') > entryIndex)
        const entry = JSON.parse(storage.objects.get(storage.calls[entryIndex]).toString())
        assert.deepEqual(
            {
                captureAttempt: entry.captureAttempt,
                reportType: entry.reportType,
                branch: entry.branch,
                prNumber: entry.prNumber,
                changedScreens: entry.changedScreens,
            },
            { captureAttempt: 1, reportType: 'capture', branch: 'dev', prNumber: 3166, changedScreens: 4 }
        )
        const manifest = JSON.parse(
            storage.objects.get(`reports/2026-09-11/dev-${commit}/run-123-1/manifest.json`).toString()
        )
        assert.equal(manifest.previewUrls, undefined)
        assert.equal(manifest.originalUrls, undefined)
        assert.match(manifest.screens[0].image, /^[a-f0-9]{64}\.webp$/)
        assert.equal(manifest.screens[0].thumbnail, manifest.screens[0].image)
        assert.equal(storage.objects.has(`assets/${name}`), false)
        assert.ok(storage.calls.indexOf(`assets/${manifest.screens[0].image}`) < entryIndex)
        assert.deepEqual(readFileSync(join(assets, name)), sourceBytes)
        assert.equal(JSON.parse(readFileSync(join(dir, 'manifest.json'))).screens[0].image, name)
        const { default: sharp } = await import('sharp')
        const metadata = await sharp(storage.objects.get(`assets/${manifest.screens[0].image}`)).metadata()
        assert.deepEqual(
            { width: metadata.width, height: metadata.height, format: metadata.format },
            {
                width: 393,
                height: 852,
                format: 'webp',
            }
        )
        assert.equal(hash(sourceBytes), name.split('.')[0])
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('publication compares exact PNGs before rewriting only the public report to WebP', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-publish-comparison-test-'))
    try {
        const assets = join(dir, 'assets')
        mkdirSync(assets)
        const beforeImage = new PNG({ width: 393, height: 852 })
        beforeImage.data.fill(0)
        const afterImage = new PNG({ width: 393, height: 852 })
        afterImage.data.fill(255)
        const beforeBytes = PNG.sync.write(beforeImage)
        const afterBytes = PNG.sync.write(afterImage)
        const beforeName = storeAsset(assets, beforeBytes)
        const afterName = storeAsset(assets, afterBytes)
        const headCommit = 'e'.repeat(40)
        const input = {
            schema: 1,
            type: 'comparison',
            before: capture(beforeName),
            after: capture(afterName, 'en', headCommit),
        }
        const inputJson = JSON.stringify(input)
        writeFileSync(join(dir, 'manifest.json'), inputJson)
        const storage = memoryStorage()
        await publishReport({
            inputDir: dir,
            reportPath: `2026-09-11/pr-3193/en/${headCommit}/run-123-1`,
            env: {
                SCREEN_LIBRARY_PUBLIC_URL: 'https://screens.example',
                EXPECTED_HEAD: headCommit,
                EXPECTED_BASE: commit,
                DEV_SEQUENCE: '123',
                RUN_ATTEMPT: '1',
                CAPTURE_ATTEMPT: '1',
            },
            storage,
        })
        const manifest = JSON.parse(
            storage.objects.get(`reports/2026-09-11/pr-3193/en/${headCommit}/run-123-1/manifest.json`).toString()
        )
        assert.equal(manifest.screens[0].status, 'changed')
        assert.match(manifest.screens[0].diff, /^[a-f0-9]{64}\.webp$/)
        assert.equal(manifest.before.screens[0].thumbnail, manifest.before.screens[0].image)
        assert.equal(manifest.after.screens[0].thumbnail, manifest.after.screens[0].image)
        assert.doesNotMatch(JSON.stringify(manifest), /\.png/)
        assert.equal(
            [...storage.objects.keys()]
                .filter((pathname) => pathname.startsWith('assets/'))
                .every((pathname) => pathname.endsWith('.webp')),
            true
        )
        assert.equal(readFileSync(join(dir, 'manifest.json'), 'utf8'), inputJson)
        assert.deepEqual(readFileSync(join(assets, beforeName)), beforeBytes)
        assert.deepEqual(readFileSync(join(assets, afterName)), afterBytes)
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
        const manifest = JSON.parse(
            storage.objects.get(`reports/2026-09-14/nutcracker/en/${commit}/run-123-1/manifest.json`).toString()
        )
        assert.match(manifest.screens[0].image, /^[a-f0-9]{64}\.webp$/)
        assert.equal(manifest.screens[0].thumbnail, manifest.screens[0].image)
        assert.equal(storage.objects.has(`assets/${originalName}`), false)
        assert.equal(storage.objects.has(`assets/${thumbnailName}`), false)
        const metadata = await sharp(storage.objects.get(`assets/${manifest.screens[0].image}`)).metadata()
        assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 240, height: 2400 })
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
