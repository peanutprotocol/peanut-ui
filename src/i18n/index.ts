import type { Locale, Translations } from './types'
import en from './en.json'
import es from './es.json'
import pt from './pt.json'

const messages: Record<Locale, Translations> = {
    en: en as Translations,
    es: es as Translations,
    pt: pt as Translations,
}

/** Get translations for a locale */
export function getTranslations(locale: Locale): Translations {
    return messages[locale] ?? messages.en
}

/** Simple template interpolation: replaces {key} with values */
export function t(template: string, vars?: Record<string, string>): string {
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export { type Locale, type Translations } from './types'
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './types'
export {
    ROUTE_SLUGS,
    localizedPath,
    localizedBarePath,
    getAlternates,
    getBareAlternates,
    isValidLocale,
    NON_DEFAULT_LOCALES,
    type RouteSlug,
} from './config'
