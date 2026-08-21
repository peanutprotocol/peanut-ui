import { resolveLocale, type AppLocale } from './app/config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './types'

// The marketing site and the product UI keep separate locale sets on purpose
// (URL-driven vs cookie-driven), but they share the `app-locale` cookie so a
// language choice on one side carries to the other. The tags differ in case
// only — marketing `pt-br` is URL-facing and indexed, the app uses `pt-BR`.

export const LOCALE_COOKIE = 'app-locale'

/** Marketing locale → app locale (`pt-br` → `pt-BR`). */
export function toAppLocale(locale: Locale): AppLocale {
    return resolveLocale(locale)
}

/**
 * Any BCP 47-ish tag → marketing locale. Mirrors resolveLocale's contract:
 * exact match first, then the language subtag, then the default. Used for both
 * the shared cookie and `navigator.language`.
 */
export function toMarketingLocale(raw: string | null | undefined): Locale {
    const tag = raw?.trim().toLowerCase()
    if (!tag) return DEFAULT_LOCALE
    const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === tag)
    if (exact) return exact
    const language = tag.split('-')[0]
    if (language === 'es') return 'es-419'
    if (language === 'pt') return 'pt-br'
    return DEFAULT_LOCALE
}

/**
 * Regional Spanish variants we ship, keyed by ISO 3166-1 alpha-2 country. Only
 * countries with their own catalog belong here — everything else keeps es-419.
 */
const REGIONAL_SPANISH: Partial<Record<string, Locale>> = {
    AR: 'es-ar',
}

/**
 * Country tiebreaker for a language-only resolution.
 *
 * `toMarketingLocale` and `resolveLocale` are language-first by design, and
 * es-419 is itself a supported tag — so a Chrome installed as "Español
 * (Latinoamérica)", the default across the region, matches es-419 exactly and
 * stops there. That is correct for Mexico and wrong for Argentina, where we
 * ship a voseo catalog nobody was reaching without hand-picking it in the
 * switcher. The visitor's country is the only signal that separates the two.
 *
 * Deliberately narrow: it upgrades es-419 and nothing else. A visitor whose
 * Accept-Language asks for English or Portuguese has stated a language
 * preference, and their IP does not override it. An explicit cookie choice is
 * resolved before this ever runs, and crawlers never reach it — Google's
 * localized-versions guidance warns against IP-based content variation, and
 * bots crawl from US IPs regardless.
 *
 * Known edge: an es-MX browser physically in Argentina also lands on es-ar,
 * since every non-Argentine Spanish collapses into es-419 upstream. The
 * footer/Settings switcher is the escape hatch, and its cookie wins forever.
 */
export function withCountry(locale: Locale, country: string | null | undefined): Locale {
    if (locale !== 'es-419') return locale
    const code = country?.trim().toUpperCase()
    return (code && REGIONAL_SPANISH[code]) || locale
}
