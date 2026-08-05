import { toAppLocale, toMarketingLocale } from '../localeBridge'
import { APP_LOCALES } from '../app/config'
import { localizeContentHref } from '../config'
import { SUPPORTED_LOCALES } from '../types'

describe('toAppLocale', () => {
    it('maps every marketing locale onto a real app locale', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(APP_LOCALES).toContain(toAppLocale(locale))
        }
    })

    it('fixes the case difference between the two systems', () => {
        // Marketing keeps lowercase pt-br because it is URL-facing and indexed.
        expect(toAppLocale('pt-br')).toBe('pt-BR')
        expect(toAppLocale('es-419')).toBe('es-419')
        expect(toAppLocale('en')).toBe('en')
    })
})

describe('toMarketingLocale', () => {
    it('round-trips through the shared cookie without drift', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(toMarketingLocale(toAppLocale(locale))).toBe(locale)
        }
    })

    it('accepts the app casing written by the product UI', () => {
        expect(toMarketingLocale('pt-BR')).toBe('pt-br')
        expect(toMarketingLocale('es-419')).toBe('es-419')
    })

    it('maps the app casing of es-AR onto its marketing twin', () => {
        expect(toMarketingLocale('es-AR')).toBe('es-ar')
    })

    it('falls back on the language subtag for browser tags', () => {
        expect(toMarketingLocale('es-ES')).toBe('es-419')
        expect(toMarketingLocale('es')).toBe('es-419')
        expect(toMarketingLocale('pt-PT')).toBe('pt-br')
        expect(toMarketingLocale('pt')).toBe('pt-br')
    })

    it('defaults to en for unsupported, empty, or missing tags', () => {
        for (const tag of ['fr-FR', 'zh-Hans-CN', 'de', '', '   ', null, undefined]) {
            expect(toMarketingLocale(tag)).toBe('en')
        }
    })

    it('is case-insensitive', () => {
        expect(toMarketingLocale('PT-BR')).toBe('pt-br')
        expect(toMarketingLocale('ES-419')).toBe('es-419')
        expect(toMarketingLocale('EN')).toBe('en')
    })
})

describe('localizeContentHref', () => {
    it('re-points a locale-prefixed href', () => {
        expect(localizeContentHref('/en/help/passkeys', 'es-419')).toBe('/es-419/help/passkeys')
        expect(localizeContentHref('/pt-br/compare/wise', 'en')).toBe('/en/compare/wise')
    })

    it('prefixes an href authored without a locale', () => {
        // Content authors write both forms; RelatedLink hrefs use the bare form.
        expect(localizeContentHref('/help/account-recovery', 'pt-br')).toBe('/pt-br/help/account-recovery')
    })

    it('leaves external links and anchors alone', () => {
        for (const href of ['https://peanut.me/shhhhh', '#chat', 'mailto:hi@peanut.me']) {
            expect(localizeContentHref(href, 'es-419')).toBe(href)
        }
    })

    it('is idempotent', () => {
        const once = localizeContentHref('/help/x', 'es-419')
        expect(localizeContentHref(once, 'es-419')).toBe(once)
    })
})
