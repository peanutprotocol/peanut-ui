import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function httpsOrigin(value, label) {
    const origin = new URL(value)
    if (
        origin.protocol !== 'https:' ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        origin.username ||
        origin.password
    )
        throw new Error(`Configure ${label} as an HTTPS origin`)
    return origin.origin
}

export function collectionWorkerConfiguration(env = process.env) {
    const bucket = env.SCREEN_LIBRARY_R2_BUCKET
    const jurisdiction = env.SCREEN_LIBRARY_R2_JURISDICTION || 'default'
    if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2 jurisdiction')
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('Configure SCREEN_LIBRARY_R2_BUCKET')
    const apiOrigin = httpsOrigin(env.SCREEN_LIBRARY_COLLECTION_API_URL, 'SCREEN_LIBRARY_COLLECTION_API_URL')
    const galleryOrigin = httpsOrigin(env.SCREEN_LIBRARY_PUBLIC_URL, 'SCREEN_LIBRARY_PUBLIC_URL')
    if (!env.SCREEN_LIBRARY_ACCESS_AUD) throw new Error('Configure SCREEN_LIBRARY_ACCESS_AUD')
    const usesWorkersDev = new URL(apiOrigin).hostname.endsWith('.workers.dev')
    return {
        name: 'peanut-screen-library-collections',
        main: 'index.mjs',
        compatibility_date: '2026-09-16',
        workers_dev: usesWorkersDev,
        preview_urls: false,
        ...(!usesWorkersDev ? { routes: [{ pattern: new URL(apiOrigin).hostname, custom_domain: true }] } : {}),
        vars: {
            SCREEN_LIBRARY_PUBLIC_URL: galleryOrigin,
            SCREEN_LIBRARY_ACCESS_AUD: env.SCREEN_LIBRARY_ACCESS_AUD,
            GITHUB_REPOSITORY: env.GITHUB_REPOSITORY || 'peanutprotocol/peanut-ui',
        },
        r2_buckets: [{ binding: 'REPORTS', bucket_name: bucket, jurisdiction }],
    }
}

export function prepareCollectionWorker(targetArg = '.screen-collection-worker', env = process.env) {
    const target = resolve(targetArg)
    mkdirSync(join(target, 'collection-worker'), { recursive: true })
    for (const file of ['access.mjs', 'collection-core.mjs'])
        copyFileSync(`scripts/screens/${file}`, join(target, file))
    copyFileSync('scripts/screens/collection-worker/index.mjs', join(target, 'collection-worker', 'index.mjs'))
    writeFileSync(join(target, 'index.mjs'), "export { default } from './collection-worker/index.mjs'\n")
    writeFileSync(join(target, 'wrangler.json'), JSON.stringify(collectionWorkerConfiguration(env), null, 2))
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) prepareCollectionWorker(process.argv[2])
