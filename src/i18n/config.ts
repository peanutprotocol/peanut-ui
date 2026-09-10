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
    'press',
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
    'status',
] as const

export type RouteSlug = (typeof ROUTE_SLUGS)[number]

/** Map locale codes to hreflang values */
export const HREFLANG_MAP: Record<Locale, string> = {
    en: 'en',
    'es-419': 'es-419',
    'es-ar': 'es-AR',
    'pt-br': 'pt-BR',
}

/**
 * Open Graph locale values (Facebook's territory format). es-419 has no OG
 * twin — es_LA is Facebook's "Spanish (Latin America)".
 */
export const OG_LOCALE_MAP: Record<Locale, string> = {
    en: 'en_US',
    'es-419': 'es_LA',
    'es-ar': 'es_AR',
    'pt-br': 'pt_BR',
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

/**
 * hreflang set restricted to `locales` (from a content-availability check) so a
 * URL whose file would only fall back is never advertised. English is always
 * included — a page with no en file doesn't render at all.
 */
export function getAlternatesFor(
    locales: readonly Locale[],
    route: RouteSlug,
    ...segments: string[]
): Record<string, string> {
    const alternates: Record<string, string> = {
        'x-default': `${BASE_URL}${localizedPath(route, 'en', ...segments)}`,
        en: `${BASE_URL}${localizedPath(route, 'en', ...segments)}`,
    }
    for (const locale of locales) {
        if (locale === DEFAULT_LOCALE) continue
        alternates[HREFLANG_MAP[locale]] = `${BASE_URL}${localizedPath(route, locale, ...segments)}`
    }
    return alternates
}

/** Get all alternate URLs for hreflang tags */
export function getAlternates(route: RouteSlug, ...segments: string[]): Record<string, string> {
    return getAlternatesFor(SUPPORTED_LOCALES, route, ...segments)
}

/** getAlternatesFor for bare paths (hub pages at /{locale}/{country}) */
export function getBareAlternatesFor(locales: readonly Locale[], ...segments: string[]): Record<string, string> {
    const alternates: Record<string, string> = {
        'x-default': `${BASE_URL}${localizedBarePath('en', ...segments)}`,
        en: `${BASE_URL}${localizedBarePath('en', ...segments)}`,
    }
    for (const locale of locales) {
        if (locale === DEFAULT_LOCALE) continue
        alternates[HREFLANG_MAP[locale]] = `${BASE_URL}${localizedBarePath(locale, ...segments)}`
    }
    return alternates
}

/** Get alternate URLs for bare paths (hub pages at /{locale}/{country}) */
export function getBareAlternates(...segments: string[]): Record<string, string> {
    return getBareAlternatesFor(SUPPORTED_LOCALES, ...segments)
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

export function isValidLocale(locale: string): locale is Locale {
    return SUPPORTED_LOCALES.includes(locale as Locale)
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale }
