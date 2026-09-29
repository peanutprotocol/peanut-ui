/**
 * Stores one Google Fonts CSS response and its font files in this folder, for
 * mock.cjs to serve to next/font in CI builds.
 *
 * Usage: node scripts/next-font-google/fetch.mjs '<css2 URL>'
 * The URL is the one next/font requests. A build with mock.cjs fetches any URL
 * missing here by itself; commit the files it leaves so CI stops fetching it.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
// next/font sends this user agent; Google picks the file format and subsets from it.
const USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
const FONT_FILE_URL = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g
const ATTEMPTS = 5

const pause = (attempt) => new Promise((resolve) => setTimeout(resolve, attempt * 2000))

async function download(url) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
            return Buffer.from(await response.arrayBuffer())
        } catch (error) {
            if (attempt === ATTEMPTS) throw error
            await pause(attempt)
        }
    }
}

/** The CSS and its font file URLs, once every URL ends in a font extension. */
async function downloadCss(url) {
    for (let attempt = 1; ; attempt++) {
        const css = (await download(url)).toString('utf8')
        const fontUrls = [...css.matchAll(FONT_FILE_URL)].map((match) => match[1])
        // next/font fails on a file URL with no font extension, which Google serves now and then.
        if (fontUrls.length && fontUrls.every((fontUrl) => /\.(woff2?|ttf|otf|eot)$/.test(fontUrl)))
            return { css, fontUrls }
        if (attempt === ATTEMPTS) throw new Error(`Unexpected font file URLs in the response for ${url}`)
        await pause(attempt)
    }
}

const url = process.argv[2]
if (!url?.startsWith('https://fonts.googleapis.com/')) throw new Error('Expected a fonts.googleapis.com URL')
const { css, fontUrls } = await downloadCss(url)
for (const fontUrl of fontUrls) {
    const file = join(DIR, 'files', new URL(fontUrl).pathname)
    if (existsSync(file)) continue
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, await download(fontUrl))
}
const cssFile = `${createHash('sha256').update(url).digest('hex').slice(0, 16)}.css`
mkdirSync(join(DIR, 'css'), { recursive: true })
writeFileSync(join(DIR, 'css', cssFile), css)
const manifestPath = join(DIR, 'manifest.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
manifest[url] = cssFile
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n')
