'use client'
import { type FC } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card } from '@/components/0_Bruddle/Card'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { BASE_URL } from '@/constants/general.consts'
import { RTF_TERMS_LABEL } from '@/constants/rain.consts'
import { toMarketingLocale } from '@/i18n/localeBridge'

interface Props {
    /** Exact authorization statement the backend will record. Shown as is, never translated. */
    authorizationText: string
    authorizationAccepted: boolean
    onAuthorizationChange: (accepted: boolean) => void
    disabled?: boolean
    /** Plain description above the checkbox (Home prompt). The new-card agreements omit it. */
    showDisclosure?: boolean
}

/**
 * The funding authorization checkbox with its terms link, optionally under a
 * plain description. The link opens the public terms in a new tab, so nothing
 * ticked is lost.
 */
const CardFundingConsent: FC<Props> = ({
    authorizationText,
    authorizationAccepted,
    onAuthorizationChange,
    disabled,
    showDisclosure,
}) => {
    const t = useTranslations('card.funding')
    // The configured site origin, so the page opens in sandbox and preview
    // builds as well as in production.
    const termsHref = `${BASE_URL}/${toMarketingLocale(useLocale())}/real-time-funding-terms`

    // The link sits inside the statement; when the backend's text does not
    // contain the term the statement is shown whole, without a link.
    const [before, ...rest] = authorizationText.split(RTF_TERMS_LABEL)
    const after = rest.join(RTF_TERMS_LABEL)
    const statement =
        rest.length > 0 ? (
            <>
                {before}
                <a
                    href={termsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-primary underline"
                >
                    {RTF_TERMS_LABEL}
                </a>
                {after}
            </>
        ) : (
            authorizationText
        )

    return (
        <div className="flex w-full flex-col gap-3 text-left" data-testid="card-funding-consent">
            {showDisclosure && (
                <div className="flex flex-col gap-2 text-body-s text-foreground-secondary">
                    <p>{t('body')}</p>
                    <p>{t('distinction')}</p>
                </div>
            )}

            <div role="list" className="flex flex-col gap-3">
                <Card role="listitem" className="flex-row items-start gap-3 p-4">
                    <Checkbox
                        value={authorizationAccepted}
                        onChange={(e) => !disabled && onAuthorizationChange(e.target.checked)}
                        className="mt-0.5"
                    />
                    <div className="flex-1 text-body-s" data-testid="funding-authorization-statement">
                        {statement}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default CardFundingConsent
