import type { Locale, Translations } from './types'
import en from './en.json'
import es419 from './es-419.json'
import esAr from './es-ar.json'
import esEs from './es-es.json'
import ptBr from './pt-br.json'

const messages: Record<Locale, Translations> = {
    en: en as Translations,
    'es-419': es419 as Translations,
    'es-ar': esAr as Translations,
    'es-es': esEs as Translations,
    'pt-br': ptBr as Translations,
}

/** Get translations for a locale (falls back to English) */
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
