import sitemap from '../sitemap'
import { getIndexablePages } from '@/lib/seo/url-inventory'
import redirects from '../../../redirects.json'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { MERCHANT_SLUGS } from '@/data/merchants'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { availableSingletonLocales } from '@/lib/content'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'

describe('public sitemap', () => {
    it('contains the shared inventory without inventing lastmod dates for static pages', async () => {
        const entries = await sitemap()
        expect(entries.map(({ url }) => new URL(url).pathname)).toEqual(getIndexablePages().map(({ path }) => path))
        for (const path of ['/', '/careers', '/en/status', '/en/content']) {
            expect(entries.find(({ url }) => new URL(url).pathname === path)).not.toHaveProperty('lastModified')
        }
    })

    it('uses authored dates and omits regeneration-only dates', async () => {
        const entries = await sitemap()
        const authored = entries.find(({ url }) => url.endsWith('/en/blog/stablecoin-balance-visa-merchants'))
        expect(authored?.lastModified).toEqual(new Date('2026-05-21'))
        const generatedOnly = entries.find(({ url }) => url.endsWith('/en/help/delete-account'))
        expect(generatedOnly).toBeDefined()
        expect(generatedOnly?.lastModified).toBeUndefined()
    })

    it('lists every feature landing page and localized status page exactly once', async () => {
        const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
        for (const path of [
            ...Object.values(STAR_LP_ROUTES),
            ...SUPPORTED_LOCALES.map((locale) => `/${locale}/status`),
        ]) {
            expect(paths.filter((entry) => entry === path)).toEqual([path])
        }
        expect(new Set(paths).size).toBe(paths.length)
    })

    it('lists only press locales that own the canonical content', async () => {
        const paths = new Set((await sitemap()).map(({ url }) => new URL(url).pathname))
        const pressLocales = availableSingletonLocales('press')
        expect(pressLocales).toContain('en')
        for (const locale of SUPPORTED_LOCALES) {
            expect(paths.has(`/${locale}/press`)).toBe(pressLocales.includes(locale))
        }
    })

    it('lists each published merchant landing page without inventing locale variants', async () => {
        const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
        expect(MERCHANT_SLUGS.length).toBeGreaterThan(0)
        expect(paths.filter((path) => path.startsWith('/m/')).sort()).toEqual(
            MERCHANT_SLUGS.map((slug) => `/m/${slug}`).sort()
        )
        expect(paths.filter((path) => /^\/(en|es-419|es-ar|pt-br)\/m\//.test(path))).toEqual([])
    })

    it('omits retired URLs while retaining their published canonical destinations', async () => {
        const paths = (await sitemap()).map(({ url }) => new URL(url).pathname)
        const permanentRedirects = redirects.filter(
            (redirect) => redirect.permanent && !redirect.source.includes(':') && !('has' in redirect)
        )
        const redirectSources = new Set(permanentRedirects.map(({ source }) => source))

        expect(paths.filter((path) => redirectSources.has(path) || isGoneMarketingPath(path))).toEqual([])

        const replacementPaths = new Set(
            permanentRedirects
                .filter(({ source }) => /^\/(en|es-419|es-ar|pt-br)\//.test(source))
                .map(({ destination }) => destination)
        )
        expect(replacementPaths.size).toBeGreaterThan(0)
        for (const replacement of replacementPaths) expect(paths).toContain(replacement)
    })
})
