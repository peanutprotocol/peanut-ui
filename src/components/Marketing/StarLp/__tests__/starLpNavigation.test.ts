import { existsSync } from 'node:fs'
import path from 'node:path'
import { getTranslations } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { STAR_LP_ROUTES } from '../starLp.consts'
import { getStarLpLinks } from '../starLpNavigation'

// A translated SEO article is not the feature landing page. All locale homes
// must discover the same six real pages without inventing prefixed routes.
describe('feature landing page navigation', () => {
    it.each(SUPPORTED_LOCALES)('%s links every feature to an existing canonical route', (locale) => {
        const links = getStarLpLinks(locale)
        expect(links).toHaveLength(6)
        expect(links.map(({ href }) => href).sort()).toEqual(Object.values(STAR_LP_ROUTES).sort())
        for (const { href } of links) {
            expect(existsSync(path.join(process.cwd(), 'src/app', href, 'page.tsx'))).toBe(true)
        }
    })

    it.each(SUPPORTED_LOCALES)('%s identifies English destinations without mislabelling their prose', (locale) => {
        for (const link of getStarLpLinks(locale)) {
            expect(link.hrefLang).toBe('en')
            expect(link.languageLabel).toBe(locale === 'en' ? null : getTranslations(locale).inEnglish)
            expect(link.label.trim()).not.toBe('')
        }
    })
})
