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
    /** The Home prompt's own extra box; not used with `authorizationOnly`. */
    managementAccepted?: boolean
    onManagementChange?: (accepted: boolean) => void
    disabled?: boolean
    /**
     * Only the authorization checkbox, with no explanation and no management
     * box: the new-card agreements screen, where it follows the original
     * agreements.
     */
    authorizationOnly?: boolean
}

/**
 * What a person agrees to for managed card funding. The Home prompt for
 * existing cardholders shows a plain description and two explicit, unchecked
 * boxes; the new-card agreements show just the authorization checkbox
 * (`authorizationOnly`). Both use the same checkbox and terms link.
 *
 * The terms are a public legal page. The link opens it in a new tab, so
 * nothing the person ticked is lost.
 */
const CardFundingConsent: FC<Props> = ({
    authorizationText,
    authorizationAccepted,
    onAuthorizationChange,
    managementAccepted = false,
    onManagementChange,
    disabled,
    authorizationOnly,
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
            {!authorizationOnly && (
                <div className="flex flex-col gap-2 text-body-s text-foreground-secondary">
                    <p>{t('body')}</p>
                    <p>{t('distinction')}</p>
                </div>
            )}

            <div role="list" className="flex flex-col gap-3">
                {!authorizationOnly && (
                    <Card role="listitem" className="flex-row items-start gap-3 p-4">
                        <Checkbox
                            value={managementAccepted}
                            onChange={(e) => !disabled && onManagementChange?.(e.target.checked)}
                            className="mt-0.5"
                        />
                        <div className="flex-1 text-body-s" data-testid="funding-management-consent">
                            {t('managementConsent')}
                        </div>
                    </Card>
                )}
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
