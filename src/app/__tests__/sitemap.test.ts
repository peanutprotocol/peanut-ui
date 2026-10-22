import sitemap from '../sitemap'
import redirects from '../../../redirects.json'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { availableSingletonLocales } from '@/lib/content'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'

describe('public sitemap', () => {
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
