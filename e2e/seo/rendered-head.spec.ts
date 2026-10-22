import { expect, test } from '@playwright/test'
import { getIndexablePages } from '../../src/lib/seo/url-inventory'

test('every sitemap URL is a direct 200, self-canonical and indexable', async ({ request, page }) => {
    const inventory = getIndexablePages()
    const canonicalOrigin = 'https://peanut.me'
    // Bingbot receives blocking metadata from Next.js: the contract inspects
    // actual server-rendered head tags without executing application scripts.
    const options = { maxRedirects: 0, headers: { 'User-Agent': 'Bingbot' }, timeout: 30_000 }
    const sitemapResponse = await request.get('/sitemap.xml', options)
    expect(sitemapResponse.status()).toBe(200)
    const sitemap = await page.evaluate(
        (xml) => {
            const document = new DOMParser().parseFromString(xml, 'application/xml')
            if (document.querySelector('parsererror')) throw new Error('Invalid sitemap XML')
            return Array.from(document.querySelectorAll('url')).map((entry) => ({
                url: entry.querySelector('loc')?.textContent ?? '',
                lastmod: entry.querySelector('lastmod')?.textContent ?? null,
            }))
        },
        await sitemapResponse.text()
    )
    await sitemapResponse.dispose()

    const expected = inventory.map(({ path }) => new URL(path, canonicalOrigin).href).sort()
    const actual = sitemap.map(({ url }) => new URL(url).href).sort()
    expect(actual).toEqual(expected)
    expect(new Set(actual).size).toBe(actual.length)

    const dates = new Map(inventory.map(({ path, lastModified }) => [path, lastModified?.toISOString() ?? null]))
    const failures: { url: string; errors: string[] }[] = []
    for (const entry of sitemap) {
        const url = new URL(entry.url)
        const errors: string[] = []
        if (entry.lastmod !== dates.get(url.pathname)) errors.push(`Unexpected lastmod: ${entry.lastmod}`)
        const response = await request.get(url.pathname, options)
        if (response.status() !== 200) {
            errors.push(`Expected direct 200; received ${response.status()} (${response.headers().location ?? ''})`)
        } else {
            const head = await page.evaluate(
                (html) => {
                    const document = new DOMParser().parseFromString(html, 'text/html')
                    return {
                        canonicals: Array.from(document.head.querySelectorAll('link[rel~="canonical" i]')).map((link) =>
                            link.getAttribute('href')
                        ),
                        robots: Array.from(document.querySelectorAll('meta[name]'))
                            .filter((meta) =>
                                ['robots', 'googlebot', 'bingbot'].includes(meta.getAttribute('name')!.toLowerCase())
                            )
                            .map((meta) => meta.getAttribute('content') ?? ''),
                    }
                },
                await response.text()
            )
            if (head.canonicals.length !== 1 || head.canonicals[0] === null) {
                errors.push(`Expected one canonical; received ${JSON.stringify(head.canonicals)}`)
            } else {
                try {
                    if (new URL(head.canonicals[0]).href !== url.href) {
                        errors.push(`Canonical points to ${head.canonicals[0]}`)
                    }
                } catch {
                    errors.push(`Canonical is not absolute: ${head.canonicals[0]}`)
                }
            }
            const robots = [...head.robots, response.headers()['x-robots-tag'] ?? '']
            if (robots.some((value) => /(?:^|[\s,:])(?:noindex|none)(?=$|[\s,;])/i.test(value))) {
                errors.push(`Indexing blocked: ${robots.join('; ')}`)
            }
        }
        await response.dispose()
        if (errors.length) failures.push({ url: entry.url, errors })
    }
    console.log(`Checked ${sitemap.length} rendered sitemap URLs; ${failures.length} failures`)
    await test.info().attach('rendered-head-results', {
        body: Buffer.from(JSON.stringify({ checked: sitemap.length, failures }, null, 2)),
        contentType: 'application/json',
    })
    expect(failures).toEqual([])
})
