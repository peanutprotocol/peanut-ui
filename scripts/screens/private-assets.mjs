import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { isDeepStrictEqual } from 'node:util'

const assetPattern = /^[a-f0-9]{64}\.(png|webp)$/
const manifestPattern = /^reports\/[a-z0-9/-]+\/manifest\.json$/
const maxArchiveSize = 512 * 1024 * 1024

const tarText = (field) => field.subarray(0, field.indexOf(0) < 0 ? field.length : field.indexOf(0)).toString('utf8')
const tarNumber = (field) => {
    const value = tarText(field).trim()
    if (!/^[0-7]+$/.test(value)) throw new Error('Invalid historical archive number')
    const number = Number.parseInt(value, 8)
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid historical archive size')
    return number
}

export function readHistoricalArchive(input) {
    if (!Buffer.isBuffer(input) || input.length === 0 || input.length > 64 * 1024 * 1024)
        throw new Error('Invalid historical archive')
    const archive = gunzipSync(input, { maxOutputLength: maxArchiveSize })
    const files = new Map()
    let offset = 0
    while (offset + 512 <= archive.length) {
        const header = archive.subarray(offset, offset + 512)
        if (header.every((byte) => byte === 0)) break
        const storedChecksum = tarNumber(header.subarray(148, 156))
        const checksum = header.reduce((total, byte, index) => total + (index >= 148 && index < 156 ? 32 : byte), 0)
        if (checksum !== storedChecksum) throw new Error('Historical archive checksum mismatch')
        const name = tarText(header.subarray(0, 100))
        const prefix = tarText(header.subarray(345, 500))
        const pathname = `${prefix ? `${prefix}/` : ''}${name}`.replace(/^\.\//, '')
        const size = tarNumber(header.subarray(124, 136))
        const start = offset + 512,
            end = start + size
        if (end > archive.length) throw new Error('Truncated historical archive')
        const type = header[156]
        const isRegular = type === 0 || type === 48
        const isManifest = pathname === 'manifest.json'
        const assetName = pathname.startsWith('assets/') ? pathname.slice('assets/'.length) : ''
        if (isManifest || assetPattern.test(assetName)) {
            if (!isRegular || files.has(pathname)) throw new Error('Invalid historical archive entry')
            if (size > 8 * 1024 * 1024) throw new Error('Historical archive entry is too large')
            files.set(pathname, Buffer.from(archive.subarray(start, end)))
        }
        offset = start + Math.ceil(size / 512) * 512
    }
    if (!files.has('manifest.json')) throw new Error('Historical archive has no manifest')
    return files
}

function reportAssetNames(report) {
    const names = new Set()
    const add = (name) => {
        if (!assetPattern.test(name ?? '')) throw new Error('Invalid historical asset reference')
        names.add(name)
    }
    const captures = report?.type === 'capture' ? [report] : [report?.before, report?.after]
    for (const capture of captures)
        for (const screen of capture?.screens ?? [])
            if (screen?.status === 'captured') {
                add(screen.image)
                add(screen.thumbnail)
            }
    if (report?.type === 'comparison') for (const screen of report.screens ?? []) if (screen?.diff) add(screen.diff)
    if (!names.size || names.size > 5000) throw new Error('Invalid historical asset set')
    return names
}

function legacyImageIds(report, assetNames) {
    const ids = new Set()
    for (const field of ['previewUrls', 'originalUrls']) {
        if (!(field in report)) continue
        const urls = report[field]
        if (!urls || Array.isArray(urls) || typeof urls !== 'object') throw new Error('Invalid legacy image map')
        for (const [name, value] of Object.entries(urls)) {
            if (!assetNames.has(name) || typeof value !== 'string') throw new Error('Invalid legacy image mapping')
            const url = new URL(value)
            const parts = url.pathname.split('/').filter(Boolean)
            if (
                url.protocol !== 'https:' ||
                url.hostname !== 'imagedelivery.net' ||
                url.username ||
                url.password ||
                url.search ||
                url.hash ||
                parts.length !== 3 ||
                !/^[\w-]+$/.test(parts[0]) ||
                !/^(?:ps-[a-f0-9]{29}|peanut-screen-[a-f0-9]{64})$/.test(parts[1]) ||
                !/^[\w-]+$/.test(parts[2])
            )
                throw new Error('Invalid legacy Cloudflare Images URL')
            ids.add(parts[1])
        }
    }
    return ids
}

async function eachBounded(values, operation, limit = 8) {
    const queue = [...values]
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
        while (queue.length) await operation(queue.shift())
    })
    await Promise.all(workers)
}

async function putImmutableAsset(storage, name, bytes) {
    const pathname = `assets/${name}`
    try {
        await storage.put(pathname, bytes, {
            allowOverwrite: false,
            contentType: name.endsWith('.png') ? 'image/png' : 'image/webp',
        })
    } catch (error) {
        let existing
        try {
            existing = await storage.read(pathname)
        } catch {
            throw error
        }
        if (!Buffer.from(existing).equals(bytes)) throw new Error(`Immutable object conflict: ${pathname}`)
    }
}

/** Move legacy public Images-backed reports behind the Access-protected R2 endpoint. */
export async function migrateLegacyReports(storage) {
    const manifests = []
    let cursor
    do {
        const page = await storage.list({ prefix: 'reports/', cursor })
        for (const blob of page.blobs) if (manifestPattern.test(blob.pathname)) manifests.push(blob.pathname)
        if (manifests.length > 10000) throw new Error('Too many historical reports')
        cursor = page.cursor
        if (!page.hasMore) break
    } while (cursor)

    let migratedReports = 0,
        migratedAssets = 0,
        removedImages = 0
    for (const manifestPath of manifests) {
        const report = JSON.parse((await storage.read(manifestPath)).toString('utf8'))
        if (!('previewUrls' in report) && !('originalUrls' in report)) continue
        const archivePath = manifestPath.replace(/manifest\.json$/, 'offline.tar.gz')
        const files = readHistoricalArchive(await storage.read(archivePath))
        const archivedReport = JSON.parse(files.get('manifest.json').toString('utf8'))
        const privateReport = { ...report }
        delete privateReport.previewUrls
        delete privateReport.originalUrls
        if (!isDeepStrictEqual(privateReport, archivedReport))
            throw new Error(`Historical manifest does not match its archive: ${manifestPath}`)
        const names = reportAssetNames(privateReport)
        const imageIds = legacyImageIds(report, names)
        await eachBounded(names, async (name) => {
            const bytes = files.get(`assets/${name}`)
            if (!bytes || createHash('sha256').update(bytes).digest('hex') !== name.slice(0, 64))
                throw new Error(`Historical asset integrity failure: ${name}`)
            if (
                (name.endsWith('.png') &&
                    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
                (name.endsWith('.webp') &&
                    (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP'))
            )
                throw new Error(`Historical asset type mismatch: ${name}`)
            await putImmutableAsset(storage, name, bytes)
        })
        if (imageIds.size && typeof storage.removeImage !== 'function')
            throw new Error('Cloudflare Images deletion is unavailable')
        // Keep the URL map until every public object is gone so a failed run is safely retryable.
        await eachBounded(imageIds, (id) => storage.removeImage(id))
        await storage.put(manifestPath, JSON.stringify(privateReport), {
            allowOverwrite: true,
            contentType: 'application/json',
            cacheControlMaxAge: 60,
        })
        migratedReports++
        migratedAssets += names.size
        removedImages += imageIds.size
    }
    return { migratedReports, migratedAssets, removedImages }
}
