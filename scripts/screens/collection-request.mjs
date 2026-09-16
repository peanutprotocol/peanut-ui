import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { COLLECTION_LOCALES, missingByLocale, validateCollection } from './collection-core.mjs'
import { createStorage } from './cloudflare-storage.mjs'

const ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const SHA = /^[a-f0-9]{40}$/

export function validateCollectionRequest(input, collectionId) {
    if (
        input?.schema !== 1 ||
        input.collectionId !== collectionId ||
        !ID.test(input.collectionId ?? '') ||
        !SHA.test(input.targetCommit ?? '') ||
        typeof input.screens !== 'object' ||
        !input.screens
    )
        throw new Error('Invalid collection capture request')
    const screens = {}
    for (const [locale, values] of Object.entries(input.screens)) {
        if (!COLLECTION_LOCALES.includes(locale) || !Array.isArray(values) || !values.length || values.length > 200)
            throw new Error('Invalid collection capture matrix')
        const unique = [...new Set(values)]
        if (unique.length !== values.length || unique.some((id) => !ID.test(id)))
            throw new Error('Invalid collection capture screen ID')
        screens[locale] = unique
    }
    if (!Object.keys(screens).length) throw new Error('Collection capture request is empty')
    return { ...input, screens }
}

export async function prepareCollectionCapture(collectionId, storage) {
    if (!ID.test(collectionId ?? '')) throw new Error('Invalid collection ID')
    const request = validateCollectionRequest(
        JSON.parse((await storage.read(`collection-requests/${collectionId}.json`)).toString('utf8')),
        collectionId
    )
    const collection = validateCollection(
        JSON.parse((await storage.read(`collections/${collectionId}/manifest.json`)).toString('utf8'))
    )
    const expected = missingByLocale(collection)
    for (const [locale, ids] of Object.entries(request.screens))
        if (ids.some((id) => !expected[locale]?.includes(id)))
            throw new Error('Capture request does not match collection gaps')
    collection.capture = { ...collection.capture, status: 'running', startedAt: new Date().toISOString() }
    await storage.put(`collections/${collectionId}/manifest.json`, JSON.stringify(collection), {
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 10,
    })
    return {
        targetCommit: request.targetCommit,
        matrix: Object.entries(request.screens).map(([locale, ids]) => ({ locale, only: ids.join(',') })),
    }
}

async function main() {
    const collectionId = process.argv[2]
    const result = await prepareCollectionCapture(collectionId, await createStorage())
    console.log(`target_commit=${result.targetCommit}`)
    console.log(`matrix=${JSON.stringify(result.matrix)}`)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) await main()
