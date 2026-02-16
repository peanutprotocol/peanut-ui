import { type Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './types'

/** All marketing route slugs — same across all locales (Wise pattern) */
export const ROUTE_SLUGS = [
    'send-money-to',
    'send-money-from',
    'convert',
    'compare',
    'deposit',
    'blog',
    'receive-money-from',
    'pay-with',
    'team',
] as const

export type RouteSlug = (typeof ROUTE_SLUGS)[number]

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
        const langCode = locale === 'en' ? 'x-default' : locale
        alternates[langCode] = `https://peanut.me${localizedPath(route, locale, ...segments)}`
    }
    // Also add 'en' explicitly alongside x-default
    alternates['en'] = `https://peanut.me${localizedPath(route, 'en', ...segments)}`
    return alternates
}

/** Get alternate URLs for bare paths (hub pages at /{locale}/{country}) */
export function getBareAlternates(...segments: string[]): Record<string, string> {
    const alternates: Record<string, string> = {}
    for (const locale of SUPPORTED_LOCALES) {
        const langCode = locale === 'en' ? 'x-default' : locale
        alternates[langCode] = `https://peanut.me${localizedBarePath(locale, ...segments)}`
    }
    alternates['en'] = `https://peanut.me${localizedBarePath('en', ...segments)}`
    return alternates
}

export function isValidLocale(locale: string): locale is Locale {
    return SUPPORTED_LOCALES.includes(locale as Locale)
}

/** Non-default locales (used in generateStaticParams for [locale] segment) */
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale }
