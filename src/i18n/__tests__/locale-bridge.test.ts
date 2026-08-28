import { toAppLocale, toMarketingLocale, withCountry } from '../localeBridge'
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

describe('withCountry', () => {
    it('upgrades a language-only es-419 for an Argentine visitor', () => {
        // The regression this exists for: Chrome's Latin American build reports
        // es-419, which matches a supported tag exactly, so nothing downstream
        // ever looked at the region and Argentina never saw its own catalog.
        expect(withCountry('es-419', 'AR')).toBe('es-ar')
    })

    it('accepts the header in any casing or padding', () => {
        expect(withCountry('es-419', 'ar')).toBe('es-ar')
        expect(withCountry('es-419', ' Ar ')).toBe('es-ar')
    })

    it('leaves es-419 alone for every country without its own catalog', () => {
        for (const country of ['MX', 'CO', 'ES', 'US', 'BR']) {
            expect(withCountry('es-419', country)).toBe('es-419')
        }
    })

    it('never overrides a stated non-Spanish language preference', () => {
        // Accept-Language is an explicit preference; an IP is not allowed to
        // beat it. An English or Portuguese speaker in Argentina keeps theirs.
        expect(withCountry('en', 'AR')).toBe('en')
        expect(withCountry('pt-br', 'AR')).toBe('pt-br')
    })

    it('leaves an already-regional Spanish untouched', () => {
        expect(withCountry('es-ar', 'MX')).toBe('es-ar')
    })

    it('is a no-op without a country header (local dev, tests, unknown IP)', () => {
        for (const country of [null, undefined, '', '   ']) {
            expect(withCountry('es-419', country)).toBe('es-419')
        }
    })

    it('only ever returns a locale the marketing routes generate', () => {
        for (const country of ['AR', 'MX', 'XX', 'T1']) {
            expect(SUPPORTED_LOCALES).toContain(withCountry('es-419', country))
        }
    })
})
