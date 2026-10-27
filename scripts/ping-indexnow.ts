/**
 * Pings IndexNow (Bing, Yandex, etc.) with all sitemap URLs.
 *
 * Usage:
 *   INDEXNOW_KEY=your-key-here tsx scripts/ping-indexnow.ts
 *
 * Preview without submitting: tsx scripts/ping-indexnow.ts --dry-run
 *
 * Or pass specific paths:
 *   INDEXNOW_KEY=xxx tsx scripts/ping-indexnow.ts /en/argentina /en/brazil
 */

import { getIndexablePages } from '../src/lib/seo/url-inventory'

const BASE_URL = 'https://peanut.me'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'
const KEY = process.env.INDEXNOW_KEY
const dryRun = process.argv.includes('--dry-run')

if (!KEY && !dryRun) {
    console.error('INDEXNOW_KEY environment variable is required')
    process.exit(1)
}

// If CLI args provided, use those. Otherwise build full URL list.
const cliPaths = process.argv.slice(2).filter((arg) => arg !== '--dry-run')

async function main() {
    const indexablePaths = getIndexablePages().map(({ path }) => path)
    const allowedPaths = new Set(indexablePaths)
    const paths = [...new Set(cliPaths.length > 0 ? cliPaths : indexablePaths)]
    const invalidPaths = paths.filter((path) => !allowedPaths.has(path))
    if (invalidPaths.length > 0) {
        throw new Error(`Paths are not in the indexable URL inventory: ${invalidPaths.join(', ')}`)
    }
    const urlList = paths.map((p) => `${BASE_URL}${p}`)

    if (dryRun) {
        console.log(urlList.join('\n'))
        return
    }

    console.log(`Submitting ${urlList.length} URLs to IndexNow...`)

    // IndexNow accepts up to 10,000 URLs per request
    const batchSize = 10000
    let failures = 0
    for (let i = 0; i < urlList.length; i += batchSize) {
        const batch = urlList.slice(i, i + batchSize)

        const payload = {
            host: 'peanut.me',
            key: KEY,
            keyLocation: `${BASE_URL}/${KEY}.txt`,
            urlList: batch,
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)
        const res = await fetch(INDEXNOW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        }).finally(() => clearTimeout(timeout))

        console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${res.status} ${res.statusText} (${batch.length} URLs)`)

        if (res.status >= 400) {
            const body = await res.text()
            console.error('  Error:', body)
            failures++
        }
    }

    if (failures > 0) {
        console.error(`${failures} batch(es) failed.`)
        process.exit(1)
    }

    console.log('Done.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})

export {}
