import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../types'
import en from '../en.json'
import es419 from '../es-419.json'
import esAr from '../es-ar.json'
import ptBr from '../pt-br.json'
import { deepMerge } from '../app/deep-merge'
import appEn from '../app/messages/en.json'
import appEs419 from '../app/messages/es-419.json'
import appEsAR from '../app/messages/es-AR.json'
import appPtBR from '../app/messages/pt-BR.json'
import allowlist from './english-identical-allowlist.json'

type Catalog = Record<string, unknown>
type FlatCatalog = Record<string, unknown>

function flatten(catalog: Catalog, prefix = ''): FlatCatalog {
    const flat: FlatCatalog = {}
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

// Space-separated words left once {placeholders} and ICU plurals are stripped: "{label}: {value}" has none.
function wordCount(value: string): number {
    let text = value
    while (/\{[^{}]*\}/.test(text)) text = text.replace(/\{[^{}]*\}/g, ' ')
    return text.split(/\s+/).filter((token) => /\p{L}/u.test(token)).length
}

function englishLeaks(enFlat: FlatCatalog, localeFlat: FlatCatalog, allowed: Set<string>): string[] {
    return Object.entries(enFlat)
        .filter(([, value]) => typeof value === 'string' && wordCount(value) >= 2)
        .filter(([key, value]) => localeFlat[key] === value && !allowed.has(key))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
}

function keyDiff(enFlat: FlatCatalog, localeFlat: FlatCatalog) {
    return {
        missing: Object.keys(enFlat).filter((key) => !(key in localeFlat)),
        extra: Object.keys(localeFlat).filter((key) => !(key in enFlat)),
    }
}

const marketing = {
    en: flatten(en),
    'es-419': flatten(es419),
    'es-ar': flatten(esAr),
    'pt-br': flatten(ptBr),
} as Record<string, FlatCatalog>
const marketingLocales = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)

// App catalogs are partial overlays that deepMerge fills from English (es-AR sits on
// es-419), so leaks are measured on what the user actually sees: the merged catalog.
const appRaw: Record<string, Catalog> = { 'es-419': appEs419, 'es-AR': appEsAR, 'pt-BR': appPtBR }
const appEnFlat = flatten(appEn)
const appMerged: Record<string, FlatCatalog> = {
    'es-419': flatten(deepMerge<Catalog>(appEn, appEs419)),
    'es-AR': flatten(deepMerge<Catalog>(deepMerge<Catalog>(appEn, appEs419), appEsAR)),
    'pt-BR': flatten(deepMerge<Catalog>(appEn, appPtBR)),
}
const appLocales = Object.keys(appRaw)

const allowedMarketing = new Set<string>(allowlist.keys)
const allowedApp = new Set<string>(allowlist.appKeys)

describe('localized copy hygiene', () => {
    it('every marketing catalog has exactly the en key set', () => {
        const problems = Object.fromEntries(
            marketingLocales
                .map((locale) => [locale, keyDiff(marketing.en, marketing[locale])] as const)
                .filter(([, diff]) => diff.missing.length || diff.extra.length)
        )
        expect(problems).toEqual({})
    })

    it('every app catalog holds only en keys, and full catalogs hold all of them', () => {
        const problems: Record<string, { missing: string[]; extra: string[] }> = {}
        for (const locale of appLocales) {
            const diff = keyDiff(appEnFlat, flatten(appRaw[locale]))
            // es-AR is deltas-only over es-419, so only extra keys count there
            if (locale === 'es-AR') diff.missing = []
            if (diff.missing.length || diff.extra.length) problems[locale] = diff
        }
        expect(problems).toEqual({})
    })

    it.each(marketingLocales)('marketing %s copies no multi-word English value', (locale) => {
        expect(englishLeaks(marketing.en, marketing[locale], allowedMarketing)).toEqual([])
    })

    it.each(appLocales)('app %s copies no multi-word English value', (locale) => {
        expect(englishLeaks(appEnFlat, appMerged[locale], allowedApp)).toEqual([])
    })

    it('allowlists name only keys that exist in en', () => {
        expect([...allowedMarketing].filter((key) => !(key in marketing.en))).toEqual([])
        expect([...allowedApp].filter((key) => !(key in appEnFlat))).toEqual([])
    })

    // The closing "Send in seconds. Pay zero fees. Start right now." fold was an
    // image with English alt text, so it stayed English on every locale.
    it.each(SUPPORTED_LOCALES)('%s has the closing CTA as translated text', (locale) => {
        const closingKeys = ['landingClosingHeadline', 'landingClosingSubline']
        const missing = closingKeys.filter((key) => typeof marketing[locale][key] !== 'string')
        const untranslated =
            locale === DEFAULT_LOCALE ? [] : closingKeys.filter((key) => marketing[locale][key] === marketing.en[key])
        expect({ missing, untranslated }).toEqual({ missing: [], untranslated: [] })
    })
})
