const language = (locale: string) => locale.toLowerCase().split('-')[0]

/**
 * Did the content fallback serve English prose to a reader of another language?
 * The hubs and the help drawer label those items. A regional fallback stays
 * unlabelled: es-ar serving es-419 prose is still Spanish.
 */
export function isEnglishFallback(servedLocale: string, readerLocale: string): boolean {
    return language(servedLocale) === 'en' && language(readerLocale) !== 'en'
}
