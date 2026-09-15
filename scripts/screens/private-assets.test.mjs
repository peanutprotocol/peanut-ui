import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PNG } from 'pngjs'
import { hash } from './core.mjs'
import { migrateLegacyReports, readHistoricalArchive } from './private-assets.mjs'

function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'screen-private-assets-'))
    const assets = join(dir, 'assets')
    mkdirSync(assets)
    const image = new PNG({ width: 393, height: 852 })
    image.data.fill(127)
    const bytes = PNG.sync.write(image)
    const name = `${hash(bytes)}.png`
    writeFileSync(join(assets, name), bytes)
    const report = {
        schema: 1,
        type: 'capture',
        screens: [
            {
                id: 'home',
                name: 'Home',
                flow: 'Home',
                kind: 'route',
                status: 'captured',
                image: name,
                thumbnail: name,
            },
        ],
    }
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(report))
    const archive = join(dir, 'offline.tar.gz')
    execFileSync('tar', ['-czf', archive, '-C', dir, 'manifest.json', 'assets'])
    return { dir, name, bytes, report, archive: readFileSync(archive) }
}

function storageFor({ report, archive, name, failDelete = false }) {
    const manifestPath = 'reports/2026-09-12/pr-3141/abc/run-1-1/manifest.json'
    const imageId = `ps-${name.slice(0, 29)}`
    const objects = new Map([
        [
            manifestPath,
            Buffer.from(
                JSON.stringify({
                    ...report,
                    previewUrls: {
                        [name]: `https://imagedelivery.net/account/${imageId}/screenpreview`,
                    },
                })
            ),
        ],
        [manifestPath.replace(/manifest\.json$/, 'offline.tar.gz'), archive],
    ])
    const events = []
    let shouldFail = failDelete
    return {
        objects,
        events,
        imageId,
        manifestPath,
        allowDelete() {
            shouldFail = false
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
            const value = objects.get(pathname)
            if (!value) throw new Error('missing')
            return value
        },
        async put(pathname, body, options = {}) {
            events.push(`put:${pathname}`)
            if (!options.allowOverwrite && objects.has(pathname)) throw new Error('already exists')
            objects.set(pathname, Buffer.isBuffer(body) ? body : Buffer.from(body))
        },
        async removeImage(id) {
            events.push(`delete:${id}`)
            if (shouldFail) throw new Error('delete failed')
        },
    }
}

test('historical reports move archive assets to private R2 and remove public Images URLs', async () => {
    const data = fixture()
    try {
        const storage = storageFor(data)
        const result = await migrateLegacyReports(storage)
        assert.deepEqual(result, {
            migratedReports: 1,
            migratedAssets: 1,
            removedImages: 1,
        })
        assert.deepEqual(storage.objects.get(`assets/${data.name}`), data.bytes)
        assert.deepEqual(JSON.parse(storage.objects.get(storage.manifestPath).toString()), data.report)
        assert.ok(
            storage.events.indexOf(`put:assets/${data.name}`) < storage.events.indexOf(`delete:${storage.imageId}`)
        )
        assert.ok(
            storage.events.indexOf(`delete:${storage.imageId}`) < storage.events.indexOf(`put:${storage.manifestPath}`)
        )
        assert.deepEqual(await migrateLegacyReports(storage), {
            migratedReports: 0,
            migratedAssets: 0,
            removedImages: 0,
        })
    } finally {
        rmSync(data.dir, { recursive: true, force: true })
    }
})

test('failed public image removal leaves the legacy manifest retryable', async () => {
    const data = fixture()
    try {
        const storage = storageFor({ ...data, failDelete: true })
        await assert.rejects(migrateLegacyReports(storage), /delete failed/)
        assert.ok(JSON.parse(storage.objects.get(storage.manifestPath).toString()).previewUrls)
        assert.deepEqual(storage.objects.get(`assets/${data.name}`), data.bytes)
        storage.allowDelete()
        await migrateLegacyReports(storage)
        assert.equal(JSON.parse(storage.objects.get(storage.manifestPath).toString()).previewUrls, undefined)
    } finally {
        rmSync(data.dir, { recursive: true, force: true })
    }
})

test('historical archives reject a modified asset before migration', () => {
    const data = fixture()
    try {
        const files = readHistoricalArchive(data.archive)
        assert.deepEqual(files.get(`assets/${data.name}`), data.bytes)
        const modified = Buffer.from(data.archive)
        modified[Math.floor(modified.length / 2)] ^= 1
        assert.throws(() => readHistoricalArchive(modified))
    } finally {
        rmSync(data.dir, { recursive: true, force: true })
    }
})
