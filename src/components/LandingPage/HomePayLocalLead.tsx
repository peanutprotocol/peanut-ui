import Link from 'next/link'
import { HOME_PAY_LOCAL_LEAD_LINK_CLASS } from './homeFolds.consts'
import type { HomePayLocalLeadProps } from './homeFolds.types'

/** f7's lead, split at its `{argentina}` and `{brazil}` slots, each country linked to its QR page. */
export function HomePayLocalLead({ lead, names, hrefs, languageLabel }: HomePayLocalLeadProps) {
    return (
        <>
            {lead.split(/(\{argentina\}|\{brazil\})/).map((part, i) => {
                const country = part === '{argentina}' ? 'argentina' : part === '{brazil}' ? 'brazil' : null
                if (!country) return part
                return (
                    <Link key={i} href={hrefs[country]} hrefLang="en" className={HOME_PAY_LOCAL_LEAD_LINK_CLASS}>
                        {names[country]}
                        {languageLabel && <span className="text-body-s"> ({languageLabel})</span>}
                    </Link>
                )
            })}
        </>
    )
}
