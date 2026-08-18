/** @jest-environment node */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { BASE_URL } from '@/constants/general.consts'
import { RECEIVE_SOURCES } from '@/data/seo'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import {
    contentGeneratedAt,
    readCorridorContent,
    readPageContent,
    readSingletonContent,
    type ContentFrontmatter,
} from '@/lib/content'
import { generateSitemap } from './sitemap'

const RECEIVE_PATH = '/receive-money-from/'

function timestamp(value: Date | string | undefined): number {
    if (!value) return Number.NaN
    return new Date(value).getTime()
}

describe('production sitemap', () => {
    it('emits unique URLs with valid, non-future and varied lastmod values', async () => {
        const sitemap = await generateSitemap()
        const urls = sitemap.map((entry) => entry.url)
        expect(new Set(urls).size).toBe(urls.length)

        const timestamps = sitemap.map((entry) => timestamp(entry.lastModified))
        expect(timestamps.every(Number.isFinite)).toBe(true)
        expect(Math.max(...timestamps)).toBeLessThanOrEqual(Date.now() + 60_000)
        expect(new Set(timestamps).size).toBeGreaterThan(10)
    })

    it('is stable across repeated generation in the same build', async () => {
        const first = await generateSitemap()
        const second = await generateSitemap()
        expect(second).toEqual(first)
    })

    it.each([
        [
            '/en/receive-money-from/australia',
            () => readPageContent<ContentFrontmatter>('receive-from', 'australia', 'en'),
        ],
        [
            '/en/send-money-from/brazil/to/argentina',
            () => readCorridorContent<ContentFrontmatter>('argentina', 'brazil', 'en'),
        ],
        ['/en/pricing', () => readSingletonContent<ContentFrontmatter>('pricing', 'en')],
    ])('maps %s lastmod to its exact source frontmatter date', async (suffix, readSource) => {
        const sitemap = await generateSitemap()
        const entry = sitemap.find((item) => item.url.endsWith(suffix))
        const sourceDate = contentGeneratedAt(readSource())
        expect(entry).toBeDefined()
        expect(timestamp(entry!.lastModified)).toBe(sourceDate?.getTime())
    })

    it('lists the independently derived receive files, without fallback-locale duplicates', async () => {
        const sitemap = await generateSitemap()
        const receiveUrls = sitemap
            .map((entry) => entry.url)
            .filter((url) => url.includes(RECEIVE_PATH))
            .sort()
        const contentRoot = path.join(process.cwd(), 'src/content/content/receive-from')
        const expected: string[] = []

        for (const source of RECEIVE_SOURCES) {
            for (const locale of SUPPORTED_LOCALES) {
                const file = path.join(contentRoot, source, `${locale}.md`)
                if (!fs.existsSync(file)) continue
                if (matter(fs.readFileSync(file, 'utf8')).data.published === false) continue
                expected.push(`${BASE_URL}/${locale}${RECEIVE_PATH}${source}`)
            }
        }

        expect(receiveUrls).toEqual(expected.sort())
    })
})
