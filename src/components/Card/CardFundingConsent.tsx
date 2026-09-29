'use client'
import { type FC, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { RTF_TERMS_LABEL } from '@/constants/rain.consts'

interface Props {
    /** Exact authorization statement the backend will record. Shown as is, never translated. */
    authorizationText: string
    /** Terms version when known; only shown in the draft panel. */
    termsVersion?: string
    managementAccepted: boolean
    authorizationAccepted: boolean
    onManagementChange: (accepted: boolean) => void
    onAuthorizationChange: (accepted: boolean) => void
    disabled?: boolean
    /** Render only the two boxes (the terms screen already sits under its own heading). */
    boxesOnly?: boolean
}

/**
 * What a person agrees to for managed card funding: a plain description of the
 * permission and the two explicit, unchecked boxes that gate every grant.
 * Shared by the Home prompt for existing cardholders and the new-user card
 * terms, so both say the same thing.
 */
const CardFundingConsent: FC<Props> = ({
    authorizationText,
    termsVersion,
    managementAccepted,
    authorizationAccepted,
    onManagementChange,
    onAuthorizationChange,
    disabled,
    boxesOnly,
}) => {
    const t = useTranslations('card.funding')
    const [termsOpen, setTermsOpen] = useState(false)

    // The link sits inside the statement; when the backend's text does not
    // contain the term the statement is shown whole, without a link.
    const [before, ...rest] = authorizationText.split(RTF_TERMS_LABEL)
    const after = rest.join(RTF_TERMS_LABEL)
    const statement =
        rest.length > 0 ? (
            <>
                {before}
                <button
                    type="button"
                    className="text-foreground-primary underline"
                    onClick={() => setTermsOpen((open) => !open)}
                    aria-expanded={termsOpen}
                >
                    {RTF_TERMS_LABEL}
                </button>
                {after}
            </>
        ) : (
            authorizationText
        )

    return (
        <div className="flex w-full flex-col gap-3 text-left" data-testid="card-funding-consent">
            {!boxesOnly && (
                <div className="flex flex-col gap-2 text-body-s text-foreground-secondary">
                    <p>{t('body')}</p>
                    <p>{t('distinction')}</p>
                </div>
            )}

            <ul className="flex flex-col gap-3">
                <li className="flex items-start gap-3 rounded-sm border border-border-default bg-background-default p-4">
                    <Checkbox
                        value={managementAccepted}
                        onChange={(e) => !disabled && onManagementChange(e.target.checked)}
                        className="mt-0.5"
                    />
                    <div className="flex-1 text-body-s" data-testid="funding-management-consent">
                        {t('managementConsent')}
                    </div>
                </li>
                <li className="flex items-start gap-3 rounded-sm border border-border-default bg-background-default p-4">
                    <Checkbox
                        value={authorizationAccepted}
                        onChange={(e) => !disabled && onAuthorizationChange(e.target.checked)}
                        className="mt-0.5"
                    />
                    <div className="flex-1 text-body-s" data-testid="funding-authorization-statement">
                        {statement}
                    </div>
                </li>
            </ul>

            {termsOpen && (
                <Callout priority="attention" title={`${RTF_TERMS_LABEL} · ${t('termsDraftBadge')}`}>
                    {t('termsDraftBody')}
                    {termsVersion ? ` ${t('termsVersion', { version: termsVersion })}` : ''}
                </Callout>
            )}
        </div>
    )
}

export default CardFundingConsent
