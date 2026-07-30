import { BASE_URL } from '@/constants/general.consts'
import { type Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './types'

/** All marketing route slugs — same across all locales (Wise pattern) */
export const ROUTE_SLUGS = [
    'send-money-to',
    'send-money-from',
    'convert',
    'compare',
    'deposit',
    'blog',
    'content',
    'receive-money-from',
    'pay-with',
    'team',
    'help',
    'use-cases',
    'withdraw',
    'stories',
    'pricing',
    'supported-networks',
    'terms',
    'privacy',
    'card-terms-us',
    'card-terms-international',
    'card-privacy',
    'card-prohibited-activities',
    'card-esign',
] as const

export type RouteSlug = (typeof ROUTE_SLUGS)[number]

/** Map locale codes to hreflang values */
const HREFLANG_MAP: Record<Locale, string> = {
    en: 'en',
    'es-419': 'es-419',
    'pt-br': 'pt-BR',
}

/** Build a localized path: all locales get /{locale}/ prefix */
export function localizedPath(route: RouteSlug, locale: Locale, ...segments: string[]): string {
    const suffix = segments.length > 0 ? `/${segments.join('/')}` : ''
    return `/${locale}/${route}${suffix}`
}

/** Build a bare localized path (no route prefix): /{locale}/{segment} */
export function localizedBarePath(locale: Locale, ...segments: string[]): string {
    const suffix = segments.length > 0 ? `/${segments.join('/')}` : ''
    return `/${locale}${suffix}`
}

/** Get all alternate URLs for hreflang tags */
export function getAlternates(route: RouteSlug, ...segments: string[]): Record<string, string> {
    const alternates: Record<string, string> = {}
    for (const locale of SUPPORTED_LOCALES) {
        const langCode = locale === 'en' ? 'x-default' : HREFLANG_MAP[locale]
        alternates[langCode] = `${BASE_URL}${localizedPath(route, locale, ...segments)}`
    }
    // Also add 'en' explicitly alongside x-default
    alternates['en'] = `${BASE_URL}${localizedPath(route, 'en', ...segments)}`
    return alternates
}

/** Get alternate URLs for bare paths (hub pages at /{locale}/{country}) */
export function getBareAlternates(...segments: string[]): Record<string, string> {
    const alternates: Record<string, string> = {}
    for (const locale of SUPPORTED_LOCALES) {
        const langCode = locale === 'en' ? 'x-default' : HREFLANG_MAP[locale]
        alternates[langCode] = `${BASE_URL}${localizedBarePath(locale, ...segments)}`
    }
    alternates['en'] = `${BASE_URL}${localizedBarePath('en', ...segments)}`
    return alternates
}

/**
 * hreflang for the landing page. English lives at `/`, not `/en` (which
 * redirects), so it can't go through getBareAlternates.
 */
export function getLandingAlternates(): Record<string, string> {
    const alternates: Record<string, string> = { 'x-default': `${BASE_URL}/`, en: `${BASE_URL}/` }
    for (const locale of SUPPORTED_LOCALES) {
        if (locale === DEFAULT_LOCALE) continue
        alternates[HREFLANG_MAP[locale]] = `${BASE_URL}/${locale}`
    }
    return alternates
}

/**
 * Re-point an internal content href at `locale`. Content authors write hrefs
 * both with and without a locale prefix (`/en/help/x` and `/help/x`), so strip
 * any leading locale before prefixing. External links and anchors pass through.
 */
export function localizeContentHref(href: string, locale: Locale): string {
    if (!href.startsWith('/')) return href
    const segments = href.split('/').filter(Boolean)
    if (segments.length > 0 && isValidLocale(segments[0])) segments.shift()
    return segments.length > 0 ? `/${locale}/${segments.join('/')}` : `/${locale}`
}

export function isValidLocale(locale: string): locale is Locale {
    return SUPPORTED_LOCALES.includes(locale as Locale)
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale }
