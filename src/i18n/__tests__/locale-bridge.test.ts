import { toAppLocale, toMarketingLocale } from '../localeBridge'
import { APP_LOCALES } from '../app/config'
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

    it('falls back on the language subtag for browser tags', () => {
        expect(toMarketingLocale('es-AR')).toBe('es-419')
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
