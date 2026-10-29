import { getStarLpLink } from '@/components/Marketing/StarLp/starLpNavigation'
import type { Locale } from '@/i18n/types'

/** The feature pages stay canonical; translated pay-with pages serve a separate search intent. */
export function homePayLocalHrefs(locale: Locale): { argentina: string; brazil: string } {
    return { argentina: getStarLpLink('qrArgentina', locale).href, brazil: getStarLpLink('qrBrazil', locale).href }
}
