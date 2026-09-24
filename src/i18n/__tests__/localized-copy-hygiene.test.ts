import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '../types'
import en from '../en.json'
import es419 from '../es-419.json'
import esAr from '../es-ar.json'
import ptBr from '../pt-br.json'
import allowlist from './english-identical-allowlist.json'

type Catalog = Record<string, unknown>

const catalogs: Record<Locale, Catalog> = {
    en,
    'es-419': es419,
    'es-ar': esAr,
    'pt-br': ptBr,
}

// The catalogs are flat today; flattening keeps the checks valid if a locale nests keys.
function flatten(catalog: Catalog, prefix = ''): Record<string, unknown> {
    const flat: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(catalog)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flat, flatten(value as Catalog, path))
        } else {
            flat[path] = value
        }
    }
    return flat
}

const flatCatalogs = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, flatten(catalogs[locale])])
) as Record<Locale, Record<string, unknown>>
const enFlat = flatCatalogs[DEFAULT_LOCALE]
const translatedLocales = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)
const allowedEnglishKeys = new Set<string>(allowlist.keys)

describe('localized copy hygiene', () => {
    it('every catalog has exactly the en key set', () => {
        const enKeys = Object.keys(enFlat)
        const problems: Record<string, { missing: string[]; extra: string[] }> = {}
        for (const locale of translatedLocales) {
            const keys = Object.keys(flatCatalogs[locale])
            const missing = enKeys.filter((key) => !(key in flatCatalogs[locale]))
            const extra = keys.filter((key) => !(key in enFlat))
            if (missing.length || extra.length) problems[locale] = { missing, extra }
        }
        expect(problems).toEqual({})
    })

    it('no multi-word English value is copied verbatim into another locale', () => {
        const leaks: Record<string, string[]> = {}
        for (const locale of translatedLocales) {
            const localeLeaks = Object.entries(enFlat)
                .filter(([, value]) => typeof value === 'string' && value.trim().includes(' '))
                .filter(([key, value]) => flatCatalogs[locale][key] === value && !allowedEnglishKeys.has(key))
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            if (localeLeaks.length) leaks[locale] = localeLeaks
        }
        expect(leaks).toEqual({})
    })

    it('allowlist names only keys that exist in en', () => {
        expect([...allowedEnglishKeys].filter((key) => !(key in enFlat))).toEqual([])
    })

    // The closing "Send in seconds. Pay zero fees. Start right now." fold was an
    // image with English alt text, so it stayed English on every locale.
    describe('closing CTA is translatable text', () => {
        const closingKeys = ['landingClosingHeadline', 'landingClosingSubline']

        it.each(SUPPORTED_LOCALES)('%s defines the closing CTA keys', (locale) => {
            const missing = closingKeys.filter((key) => typeof flatCatalogs[locale][key] !== 'string')
            expect(missing).toEqual([])
        })

        it.each(translatedLocales)('%s translates the closing CTA', (locale) => {
            const untranslated = closingKeys.filter(
                (key) => typeof enFlat[key] !== 'string' || flatCatalogs[locale][key] === enFlat[key]
            )
            expect(untranslated).toEqual([])
        })
    })
})
