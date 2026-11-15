import { getTranslations } from '@/i18n'
import type { Locale, Translations } from '@/i18n/types'
import { STAR_LP_ROUTES } from './starLp.consts'

export type StarLpKey = keyof typeof STAR_LP_ROUTES

const FEATURE_LABELS = {
    usEuAccounts: 'starLpUsEuAccounts',
    requestLinks: 'starLpRequestLinks',
    selfCustody: 'starLpSelfCustody',
    peanutCard: 'starLpPeanutCard',
    qrArgentina: 'starLpQrArgentina',
    qrBrazil: 'starLpQrBrazil',
} as const satisfies Record<StarLpKey, keyof Translations>

/** All six feature pages currently have English prose, even when linked from a translated page. */
export function getStarLpLink(key: StarLpKey, locale: Locale) {
    const i18n = getTranslations(locale)
    return {
        key,
        href: STAR_LP_ROUTES[key],
        label: i18n[FEATURE_LABELS[key]],
        hrefLang: 'en' as const,
        languageLabel: locale === 'en' ? null : i18n.inEnglish,
    }
}

export function getStarLpLinks(locale: Locale) {
    return (Object.keys(FEATURE_LABELS) as StarLpKey[]).map((key) => getStarLpLink(key, locale))
}
