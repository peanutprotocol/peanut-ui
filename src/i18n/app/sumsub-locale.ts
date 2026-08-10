import type { AppLocale } from './config'

const SUMSUB_LOCALES: Record<AppLocale, string> = {
    en: 'en',
    'es-419': 'es',
    'es-AR': 'es',
    'pt-BR': 'pt-br',
}

export function toSumsubLocale(locale: AppLocale): string {
    return SUMSUB_LOCALES[locale]
}
