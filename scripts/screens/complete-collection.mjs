import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { hash, validateCapture, verifyAsset } from './core.mjs'
import { validateCollection } from './collection-core.mjs'
import { validateCollectionRequest } from './collection-request.mjs'
import { createStorage } from './cloudflare-storage.mjs'

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/

function capturesIn(root) {
    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'capture.json')))
        .map((entry) => ({
            dir: join(root, entry.name),
            report: validateCapture(JSON.parse(readFileSync(join(root, entry.name, 'capture.json'), 'utf8'))),
        }))
}

export async function completeCollection({ collectionId, inputDir, storage, sharpFactory }) {
    if (!ID.test(collectionId ?? '')) throw new Error('Invalid collection ID')
    const collectionKey = `collections/${collectionId}/manifest.json`
    const collection = validateCollection(JSON.parse((await storage.read(collectionKey)).toString('utf8')))
    const request = validateCollectionRequest(
        JSON.parse((await storage.read(`collection-requests/${collectionId}.json`)).toString('utf8')),
        collectionId
    )
    if (collection.capture?.attempt !== request.attempt) throw new Error('Capture attempt is no longer current')
    const sharp = sharpFactory ?? (await import('sharp')).default
    const captures = capturesIn(resolve(inputDir))
    const failedLocales = []
    for (const [locale, ids] of Object.entries(request.screens)) {
        const capture = captures.find((candidate) => candidate.report.locale === locale)
        if (!capture || capture.report.commit !== request.targetCommit) {
            failedLocales.push(locale)
            continue
        }
        const byId = new Map(capture.report.screens.map((screen) => [screen.id, screen]))
        for (const id of ids) {
            const screen = byId.get(id)
            const item = collection.items.find((candidate) => candidate.id === id)
            if (!item || screen?.status !== 'captured' || !screen.image) continue
            const png = verifyAsset(join(capture.dir, 'assets'), screen.image)
            const webp = await sharp(png, { limitInputPixels: 393 * 852 })
                .resize({ width: 393, height: 852, fit: 'fill' })
                .webp({
                    quality: 90,
                    alphaQuality: 100,
                    smartSubsample: true,
                    effort: 4,
                })
                .toBuffer()
            const name = `${hash(webp)}.webp`
            try {
                await storage.put(`assets/${name}`, webp, {
                    contentType: 'image/webp',
                })
            } catch (cause) {
                const current = await storage.read(`assets/${name}`).catch(() => null)
                if (!current?.equals(webp)) throw cause
            }
            item.name = screen.name
            item.flow = screen.flow
            item.kind = screen.kind
            item.variants[locale] = {
                status: 'captured',
                image: name,
                thumbnail: name,
                commit: capture.report.commit,
            }
        }
    }
    const updated = validateCollection(collection)
    const capture = { ...collection.capture }
    delete capture.failedLocales
    updated.capture = {
        ...capture,
        status: updated.complete ? 'complete' : 'partial',
        finishedAt: new Date().toISOString(),
        ...(failedLocales.length ? { failedLocales } : {}),
    }
    await storage.put(collectionKey, JSON.stringify(updated), {
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 10,
    })
    await storage.put(
        `collection-entries/${collectionId}.json`,
        JSON.stringify({
            id: collectionId,
            title: updated.title,
            createdAt: updated.createdAt,
            complete: updated.complete,
        }),
        {
            allowOverwrite: true,
            contentType: 'application/json',
            cacheControlMaxAge: 10,
        }
    )
    if (!updated.complete) throw new Error(`${updated.missing.length} collection variants could not be captured`)
    return updated
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
    const collectionId = process.argv[2]
    const updated = await completeCollection({
        collectionId,
        inputDir: process.argv[3],
        storage: await createStorage(),
    })
    console.log(`${process.env.SCREEN_LIBRARY_PUBLIC_URL.replace(/\/$/, '')}/collections/${updated.id}/`)
}
