import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../types'
import en from '../en.json'
import es419 from '../es-419.json'
import esAr from '../es-ar.json'
import ptBr from '../pt-br.json'
import { APP_LOCALES } from '../app/config'
import { loadMessages } from '../app/messages'
import { leafEntries } from '../app/__tests__/catalog-helpers'
import allowlist from './english-identical-allowlist.json'

// the allowlist holds keys whose English value is intentionally reused (brand names,
// proper nouns, currency codes), each scoped to the locales where it stays English.
// marketing = src/i18n/*.json, app = src/i18n/app/messages
type FlatCatalog = Record<string, string>
type Allowlist = Record<string, { locales: string[]; reason: string }>

const flat = (catalog: object): FlatCatalog => Object.fromEntries(leafEntries(catalog as Record<string, unknown>))

// Space-separated words left once {placeholders} and ICU plurals are stripped: "{label}: {value}" has none.
function wordCount(value: string): number {
    let text = value
    while (/\{[^{}]*\}/.test(text)) text = text.replace(/\{[^{}]*\}/g, ' ')
    return text.split(/\s+/).filter((token) => /\p{L}/u.test(token)).length
}

function englishLeaks(enFlat: FlatCatalog, localeFlat: FlatCatalog, locale: string, allowed: Allowlist): string[] {
    return Object.entries(enFlat)
        .filter(([, value]) => wordCount(value) >= 2)
        .filter(([key, value]) => localeFlat[key] === value && !allowed[key]?.locales.includes(locale))
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
}

// an allowlist entry is stale once its key is gone, its en value is under two
// words (never checked), or a listed locale no longer copies the en value
function staleEntries(allowed: Allowlist, catalogs: Record<string, FlatCatalog>): string[] {
    return Object.entries(allowed).flatMap(([key, { locales, reason }]) => {
        const enValue = catalogs.en[key]
        if (enValue === undefined) return [`${key}: not in en`]
        if (wordCount(enValue) < 2) return [`${key}: en value under two words`]
        if (!reason.trim()) return [`${key}: no reason`]
        return locales
            .filter((locale) => catalogs[locale]?.[key] !== enValue)
            .map((locale) => `${key}: ${locale} no longer matches en`)
    })
}

const marketing: Record<string, FlatCatalog> = {
    en: flat(en),
    'es-419': flat(es419),
    'es-ar': flat(esAr),
    'pt-br': flat(ptBr),
}
const marketingLocales = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)

// app catalogs are partial overlays filled from English, so leaks are measured on
// what the user actually sees: the merged catalog
const appLocales = APP_LOCALES.filter((locale) => locale !== 'en')
const app: Record<string, FlatCatalog> = {}

beforeAll(async () => {
    for (const locale of APP_LOCALES) app[locale] = flat(await loadMessages(locale))
})

describe('localized copy hygiene', () => {
    it.each(marketingLocales)('marketing %s copies no multi-word English value', (locale) => {
        expect(englishLeaks(marketing.en, marketing[locale], locale, allowlist.marketing)).toEqual([])
    })

    it.each(appLocales)('app %s copies no multi-word English value', (locale) => {
        expect(englishLeaks(app.en, app[locale], locale, allowlist.app)).toEqual([])
    })

    it('allowlist entries are still needed and have a reason', () => {
        expect(staleEntries(allowlist.marketing, marketing)).toEqual([])
        expect(staleEntries(allowlist.app, app)).toEqual([])
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
