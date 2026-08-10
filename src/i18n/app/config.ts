import { type Locale as MarketingLocale } from '../types'

// App (product UI) locales — separate from the marketing site's i18n
// (src/i18n/*.json), which keeps its own locale set for SEO routing.
export const APP_LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_APP_LOCALE: AppLocale = 'en'

/** Marketing routes are keyed by lowercase tags, so the app's `pt-BR` is `pt-br` there. */
const MARKETING_SEGMENT: Record<AppLocale, MarketingLocale> = {
    en: 'en',
    'es-419': 'es-419',
    'pt-BR': 'pt-br',
}

/**
 * Retargets a hardcoded `/en/…` marketing path at the reader's app locale. Safe for
 * any marketing slug: every locale × slug pair is statically generated and falls back
 * to English content, so a path built this way resolves even when untranslated.
 */
export function localizeMarketingPath(path: string, locale: AppLocale): string {
    if (!path.startsWith('/en/')) return path
    return `/${MARKETING_SEGMENT[locale]}${path.slice('/en'.length)}`
}

/** Native-language display names for the language picker. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
    en: 'English',
    'es-419': 'Español',
    'es-AR': 'Español (Argentina)',
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
