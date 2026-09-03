'use client'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useLocale, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { toMarketingLocale } from '@/i18n/localeBridge'
import type { Locale as MarketingLocale } from '@/i18n/types'

interface Props {
    isUsResident: boolean
    onAccept: () => void | Promise<void>
    onPrev?: () => void
    submitError?: string | null
}

// Rain partner constant — the "Partner" placeholder in the term-copy comps
// stands in for Peanut. Swap if the partnership agreement renames the card.
const CARD_PARTNER_NAME = 'Peanut'

// US and international cardholders accept different card-terms documents.
// The marketing pages are locale-routed and fall back to English prose when a
// legal doc has no translation yet, so linking the user's own locale is always
// safe — hardcoding /en/ was not.
const linksFor = (locale: MarketingLocale) => ({
    eSign: `https://peanut.me/${locale}/card-esign`,
    issuerPrivacy: 'https://www.third-national.com/privacypolicy',
    cardTermsUs: `https://peanut.me/${locale}/card-terms-us`,
    cardTermsInternational: `https://peanut.me/${locale}/card-terms-international`,
    accountOpeningPrivacy: `https://peanut.me/${locale}/card-privacy`,
})

interface Term {
    id: string
    label: ReactNode
}

const ExternalLink: FC<{ href: string; children: ReactNode }> = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground-primary underline">
        {children}
    </a>
)

const CardTermsScreen: FC<Props> = ({ isUsResident, onAccept, onPrev, submitError }) => {
    const t = useTranslations('card.terms')
    const tCard = useTranslations('card')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)

    const links = useMemo(() => linksFor(toMarketingLocale(locale)), [locale])

    const terms = useMemo<Term[]>(() => {
        const esignTerm: Term = {
            id: 'esign',
            label: t.rich('esign', {
                link: (chunks) => <ExternalLink href={links.eSign}>{chunks}</ExternalLink>,
            }),
        }
        const cardTermsIssuerTerm: Term = {
            id: 'cardTermsIssuer',
            label: t.rich('cardTermsIssuer', {
                partner: CARD_PARTNER_NAME,
                terms: (chunks) => (
                    <ExternalLink href={isUsResident ? links.cardTermsUs : links.cardTermsInternational}>
                        {chunks}
                    </ExternalLink>
                ),
                privacy: (chunks) => <ExternalLink href={links.issuerPrivacy}>{chunks}</ExternalLink>,
            }),
        }
        const accuracyTerm: Term = { id: 'accuracy', label: t('accuracy', { partner: CARD_PARTNER_NAME }) }
        const solicitationTerm: Term = {
            id: 'solicitation',
            label: t('solicitation', { partner: CARD_PARTNER_NAME }),
        }
        if (!isUsResident) return [esignTerm, cardTermsIssuerTerm, accuracyTerm, solicitationTerm]
        const accountOpeningPrivacyTerm: Term = {
            id: 'accountOpeningPrivacy',
            label: t.rich('accountOpeningPrivacy', {
                link: (chunks) => <ExternalLink href={links.accountOpeningPrivacy}>{chunks}</ExternalLink>,
            }),
        }
        return [esignTerm, accountOpeningPrivacyTerm, cardTermsIssuerTerm, accuracyTerm, solicitationTerm]
    }, [isUsResident, t, links])

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_TERMS_VIEWED, {
            is_us_resident: isUsResident,
            terms_count: terms.length,
        })
    }, [isUsResident, terms.length])

    const allAccepted = useMemo(() => terms.every((t) => checked[t.id]), [terms, checked])

    const handleContinue = async () => {
        if (!allAccepted) return
        setSubmitting(true)
        try {
            await onAccept()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PageStack gap="6">
            <NavHeader title={tCard('navAddCard')} onPrev={onPrev} />

            <div className="flex flex-col gap-2">
                <h1 className="text-heading-s text-foreground-primary">{t('title')}</h1>
                <p className="text-foreground-secondary">{t('description')}</p>
            </div>

            <ul className="flex flex-col gap-3">
                {terms.map((term) => (
                    <li
                        key={term.id}
                        className="flex items-start gap-3 rounded-sm border border-border-default bg-background-default p-4"
                    >
                        <Checkbox
                            value={!!checked[term.id]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [term.id]: e.target.checked }))}
                            className="mt-0.5"
                        />
                        <div className="flex-1 text-body-s">{term.label}</div>
                    </li>
                ))}
            </ul>

            {submitError && <p className="text-body-s text-foreground-error">{submitError}</p>}

            <Button
                variant="purple"
                shadowSize="4"
                className="mt-auto w-full"
                onClick={handleContinue}
                disabled={!allAccepted || submitting}
                loading={submitting}
            >
                {tCommon('continue')}
            </Button>
        </PageStack>
    )
}

export default CardTermsScreen
