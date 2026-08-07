/**
 * Submits URLs to IndexNow (Bing, Yandex, Seznam, Naver).
 *
 * IndexNow is for URLs that were added, updated or deleted — resubmitting the whole
 * site on every deploy burns the daily quota and gets the host deprioritised. So the
 * default mode is a delta: the sitemap's URL set is diffed against the set submitted
 * last time, and content files changed since then are mapped back to the pages they
 * render.
 *
 * Usage:
 *   INDEXNOW_KEY=xxx tsx scripts/ping-indexnow.ts              # delta vs. previous run
 *   INDEXNOW_KEY=xxx INDEXNOW_FULL=true tsx …                  # every sitemap URL
 *   INDEXNOW_KEY=xxx tsx scripts/ping-indexnow.ts /en/brazil   # explicit paths
 *
 * Env:
 *   INDEXNOW_KEY            required; must match public/<key>.txt
 *   INDEXNOW_FULL           'true' to submit the full sitemap
 *   INDEXNOW_CHANGED_FILES  newline-separated paths, relative to the content submodule
 *   INDEXNOW_CONTENT_SHA    content submodule commit, recorded for the next run's diff
 *   GITHUB_SHA              superproject commit, recorded for the next run's diff
 *   INDEXNOW_STATE_FILE     defaults to .indexnow-state/urls.json
 */

import fs from 'fs'
import path from 'path'
import generateSitemap from '../src/app/sitemap'
import { BASE_URL } from '../src/constants/general.consts'

const PRODUCTION_ORIGIN = 'https://peanut.me'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'
const MAX_URLS_PER_REQUEST = 10_000

const KEY = process.env.INDEXNOW_KEY
const STATE_FILE = process.env.INDEXNOW_STATE_FILE || path.join(process.cwd(), '.indexnow-state/urls.json')

if (!KEY) {
    console.error('INDEXNOW_KEY environment variable is required')
    process.exit(1)
}

interface State {
    /** Commits the last submission accounted for, so the next run knows what to diff against. */
    sha?: string
    contentSha?: string
    submittedAt?: string
    urls: string[]
}

function readState(): State | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as State
        return Array.isArray(parsed.urls) ? parsed : null
    } catch {
        return null
    }
}

function writeState(urls: string[]) {
    const state: State = {
        sha: process.env.GITHUB_SHA || undefined,
        contentSha: process.env.INDEXNOW_CONTENT_SHA || undefined,
        submittedAt: new Date().toISOString(),
        urls,
    }
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(state))
}

/**
 * The sitemap is the single source of truth for which URLs exist. It is built with
 * BASE_URL, which is env-dependent — rewrite onto the production origin so a stray
 * NEXT_PUBLIC_BASE_URL can never make us submit preview URLs for peanut.me.
 */
async function listSitemapUrls(): Promise<string[]> {
    const entries = await generateSitemap()
    const urls = entries.map((entry) =>
        entry.url.startsWith(BASE_URL) ? `${PRODUCTION_ORIGIN}${entry.url.slice(BASE_URL.length)}` : entry.url
    )
    return [...new Set(urls)]
}

/**
 * Reduce a changed content file to the slugs that identify the page it renders.
 *
 * Paths are content/{intent}/{slug}/{lang}.md, content/{intent}/{lang}.md (singleton) or
 * content/send-to/{dst}/from/{src}/{lang}.md (corridor). The intent segment is dropped
 * when a slug follows it, since routes rename intents (`compare` → `/compare/peanut-vs-…`,
 * `send-to` → `/send-money-to/…`) and matching on it would sweep in every sibling page.
 * Matching on slugs alone needs no intent→route table, so there is nothing to drift.
 */
function changedSlugSets(files: string[]): string[][] {
    const sets = new Map<string, string[]>()
    for (const file of files) {
        const segments = file.split('/').filter(Boolean)
        if (segments[0] === 'content') segments.shift()
        segments.pop() // {lang}.md — every locale of a page maps to the same slugs
        const slugs = (segments.length > 1 ? segments.slice(1) : segments).filter((s) => s !== 'from')
        if (slugs.length > 0) sets.set(slugs.join('/'), slugs)
    }
    return [...sets.values()]
}

/**
 * A URL is touched when one of a changed page's slugs is its leaf segment and the rest
 * appear earlier in the path. Anchoring on the leaf is what keeps `help` (the singleton
 * index) off every `/help/{article}`; the "rest appear earlier" half is what pins a
 * corridor's {dst, src} pair to `/send-money-from/{src}/to/{dst}` alone.
 */
function urlTouchedBy(url: string, slugSets: string[][]): boolean {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const leaf = segments[segments.length - 1] ?? ''
    const isLeaf = (slug: string) =>
        leaf === slug || leaf === `peanut-vs-${slug}` || leaf === `from-${slug}` || leaf === `via-${slug}`
    return slugSets.some(
        (slugs) => slugs.some(isLeaf) && slugs.every((slug) => isLeaf(slug) || segments.includes(slug))
    )
}

/** Exits non-zero on any failure, which leaves the state file untouched so the next run retries. */
async function submit(urls: string[]) {
    let failures = 0

    for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
        const batch = urls.slice(i, i + MAX_URLS_PER_REQUEST)
        const label = `Batch ${Math.floor(i / MAX_URLS_PER_REQUEST) + 1}`

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)
        try {
            const res = await fetch(INDEXNOW_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                    host: 'peanut.me',
                    key: KEY,
                    keyLocation: `${PRODUCTION_ORIGIN}/${KEY}.txt`,
                    urlList: batch,
                }),
                signal: controller.signal,
            })

            console.log(`${label}: ${res.status} ${res.statusText} (${batch.length} URLs)`)

            if (res.status >= 400) {
                console.error('  Error:', await res.text())
                failures++
            }
        } catch (err) {
            // A timeout or transport error is a failed batch, not a reason to abandon the rest.
            console.error(`${label}: request failed (${batch.length} URLs) —`, err)
            failures++
        } finally {
            clearTimeout(timeout)
        }
    }

    if (failures > 0) {
        console.error(`${failures} batch(es) failed.`)
        process.exit(1)
    }
}

async function main() {
    const cliPaths = process.argv.slice(2)
    if (cliPaths.length > 0) {
        const urls = cliPaths.map((p) => `${PRODUCTION_ORIGIN}${p}`)
        console.log(`Submitting ${urls.length} explicitly requested URLs.`)
        await submit(urls)
        console.log('Done.')
        return
    }

    const current = await listSitemapUrls()
    const previous = readState()

    if (!previous) {
        console.log(`No previous submission on record — submitting all ${current.length} sitemap URLs.`)
        await submit(current)
        writeState(current)
        console.log('Done.')
        return
    }

    if (process.env.INDEXNOW_FULL === 'true') {
        console.log(`Full submission requested — submitting all ${current.length} sitemap URLs.`)
        await submit(current)
        writeState(current)
        console.log('Done.')
        return
    }

    const known = new Set(previous.urls)
    const added = current.filter((url) => !known.has(url))

    const slugSets = changedSlugSets((process.env.INDEXNOW_CHANGED_FILES || '').split('\n').filter(Boolean))
    const isAdded = new Set(added)
    const updated = slugSets.length > 0 ? current.filter((url) => !isAdded.has(url) && urlTouchedBy(url, slugSets)) : []

    const urls = [...added, ...updated]
    console.log(
        `Sitemap has ${current.length} URLs: ${added.length} new, ${updated.length} touched by ${slugSets.length} changed page(s).`
    )

    if (urls.length === 0) {
        console.log('Nothing changed — skipping IndexNow submission.')
        writeState(current)
        return
    }

    await submit(urls)
    writeState(current)
    console.log('Done.')
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
