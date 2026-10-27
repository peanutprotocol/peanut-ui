import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import type { Locale } from '@/i18n/types'

/** Where each country leads: the English star LPs on the English home, the localized pay-with pages elsewhere. */
export function homePayLocalHrefs(locale: Locale): { argentina: string; brazil: string } {
    if (locale === 'en') return { argentina: STAR_LP_ROUTES.qrArgentina, brazil: STAR_LP_ROUTES.qrBrazil }
    return { argentina: `/${locale}/pay-with/mercadopago`, brazil: `/${locale}/pay-with/pix` }
}
