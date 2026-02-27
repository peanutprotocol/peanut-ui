/**
 * Pings IndexNow (Bing, Yandex, etc.) with all sitemap URLs.
 *
 * Usage:
 *   INDEXNOW_KEY=your-key-here tsx scripts/ping-indexnow.ts
 *
 * Or pass specific paths:
 *   INDEXNOW_KEY=xxx tsx scripts/ping-indexnow.ts /en/argentina /en/brazil
 */

const BASE_URL = 'https://peanut.me'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'
const KEY = process.env.INDEXNOW_KEY

if (!KEY) {
    console.error('INDEXNOW_KEY environment variable is required')
    process.exit(1)
}

// If CLI args provided, use those. Otherwise build full URL list.
const cliPaths = process.argv.slice(2)

async function getAllPaths(): Promise<string[]> {
    // Dynamic import to reuse the same data sources as sitemap.ts
    const { COUNTRIES_SEO, CORRIDORS, COMPETITORS, EXCHANGES, PAYMENT_METHOD_SLUGS } =
        await import('../src/data/seo/index')
    const { SUPPORTED_LOCALES } = await import('../src/i18n/types')
    const { listContentSlugs } = await import('../src/lib/content')

    const paths: string[] = ['/', '/lp/card', '/careers', '/exchange', '/privacy', '/terms']

    for (const locale of SUPPORTED_LOCALES) {
        for (const country of Object.keys(COUNTRIES_SEO)) {
            paths.push(`/${locale}/${country}`)
            paths.push(`/${locale}/send-money-to/${country}`)
        }
        for (const corridor of CORRIDORS) {
            paths.push(`/${locale}/send-money-from/${corridor.from}/to/${corridor.to}`)
        }
        const receiveSources = [...new Set(CORRIDORS.map((c: { from: string }) => c.from))]
        for (const source of receiveSources) {
            paths.push(`/${locale}/receive-money-from/${source}`)
        }
        for (const slug of Object.keys(COMPETITORS)) {
            paths.push(`/${locale}/compare/peanut-vs-${slug}`)
        }
        for (const slug of Object.keys(EXCHANGES)) {
            paths.push(`/${locale}/deposit/from-${slug}`)
        }
        for (const method of PAYMENT_METHOD_SLUGS) {
            paths.push(`/${locale}/pay-with/${method}`)
        }
        paths.push(`/${locale}/help`)
        for (const slug of listContentSlugs('help')) {
            paths.push(`/${locale}/help/${slug}`)
        }
    }

    return paths
}

async function main() {
    const paths = cliPaths.length > 0 ? cliPaths : await getAllPaths()
    const urlList = paths.map((p) => `${BASE_URL}${p}`)

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
