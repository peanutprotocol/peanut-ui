import type { Locale, Translations } from './types'
import en from './en.json'
import es419 from './es-419.json'
import esAr from './es-ar.json'
import ptBr from './pt-br.json'

const messages: Record<Locale, Translations> = {
    en: en as Translations,
    'es-419': es419 as Translations,
    'es-ar': esAr as Translations,
    'pt-br': ptBr as Translations,
}

/** Get translations for a locale (falls back to English) */
export function getTranslations(locale: Locale): Translations {
    return messages[locale] ?? messages.en
}

export { t } from './interpolate'
