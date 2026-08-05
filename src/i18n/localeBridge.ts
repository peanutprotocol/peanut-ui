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
