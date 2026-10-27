import Link from 'next/link'
import type { ReactNode } from 'react'
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import type { Locale } from '@/i18n/types'

const LEAD_LINK_CLASS = 'font-bold underline decoration-2 underline-offset-4'

/** Where each country leads: the English star LPs on the English home, the localized pay-with pages elsewhere. */
export function homePayLocalHrefs(locale: Locale): { argentina: string; brazil: string } {
    if (locale === 'en') return { argentina: STAR_LP_ROUTES.qrArgentina, brazil: STAR_LP_ROUTES.qrBrazil }
    return { argentina: `/${locale}/pay-with/mercadopago`, brazil: `/${locale}/pay-with/pix` }
}

/** Splits the lead at its `{argentina}` and `{brazil}` slots and links each country to its QR page. */
export function leadWithLinks(
    lead: string,
    names: { argentina: string; brazil: string },
    hrefs: { argentina: string; brazil: string }
): ReactNode[] {
    return lead.split(/(\{argentina\}|\{brazil\})/).map((part, i) => {
        const country = part === '{argentina}' ? 'argentina' : part === '{brazil}' ? 'brazil' : null
        if (!country) return part
        return (
            <Link key={i} href={hrefs[country]} className={LEAD_LINK_CLASS}>
                {names[country]}
            </Link>
        )
    })
}
