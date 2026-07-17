// App (product UI) locales — separate from the marketing site's i18n
// (src/i18n/*.json), which keeps its own locale set for SEO routing.
export const APP_LOCALES = ['en', 'es-419', 'pt-BR'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_APP_LOCALE: AppLocale = 'en'

/** Native-language display names for the language picker. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
    en: 'English',
    'es-419': 'Español',
    'pt-BR': 'Português (Brasil)',
}

/**
 * Normalizes any BCP 47-ish tag (device language, cookie, navigator.language)
 * to a supported app locale. Every locale source must pass through here so an
 * unsupported tag can never reach the intl provider.
 */
export function resolveLocale(raw: string | null | undefined): AppLocale {
    if (!raw) return DEFAULT_APP_LOCALE
    const tag = raw.trim().toLowerCase()
    if (!tag) return DEFAULT_APP_LOCALE
    const exact = APP_LOCALES.find((locale) => locale.toLowerCase() === tag)
    if (exact) return exact
    const language = tag.split('-')[0]
    if (language === 'es') return 'es-419'
    if (language === 'pt') return 'pt-BR'
    return DEFAULT_APP_LOCALE
}
