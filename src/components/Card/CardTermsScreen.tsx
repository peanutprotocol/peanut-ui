'use client'
import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'

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
const LINKS = {
    eSign: 'https://peanut.me/en/card-esign',
    issuerPrivacy: 'https://www.third-national.com/privacypolicy',
    cardTermsUs: 'https://peanut.me/en/card-terms-us',
    cardTermsInternational: 'https://peanut.me/en/card-terms-international',
    accountOpeningPrivacy: 'https://peanut.me/en/card-privacy',
}

interface Term {
    id: string
    label: ReactNode
}

const ExternalLink: FC<{ href: string; children: ReactNode }> = ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-black underline">
        {children}
    </a>
)

const esignTerm: Term = {
    id: 'esign',
    label: (
        <>
            I accept the <ExternalLink href={LINKS.eSign}>E-Sign Consent</ExternalLink>
        </>
    ),
}

const cardTermsIssuerTerm = (cardTermsHref: string): Term => ({
    id: 'cardTermsIssuer',
    label: (
        <>
            I accept the <ExternalLink href={cardTermsHref}>{CARD_PARTNER_NAME} Card Terms</ExternalLink>
            {', and the '}
            <ExternalLink href={LINKS.issuerPrivacy}>Issuer Privacy Policy</ExternalLink>
        </>
    ),
})

const accuracyTerm: Term = {
    id: 'accuracy',
    label: `I certify that the information I have provided is accurate and that I will abide by all the rules and requirements related to my ${CARD_PARTNER_NAME} Spend Card.`,
}

const solicitationTerm: Term = {
    id: 'solicitation',
    label: `I acknowledge that applying for the ${CARD_PARTNER_NAME} Spend Card does not constitute unauthorized solicitation.`,
}

const accountOpeningPrivacyTerm: Term = {
    id: 'accountOpeningPrivacy',
    label: (
        <>
            I accept the <ExternalLink href={LINKS.accountOpeningPrivacy}>Account Opening Privacy Notice</ExternalLink>
        </>
    ),
}

const INT_TERMS: Term[] = [esignTerm, cardTermsIssuerTerm(LINKS.cardTermsInternational), accuracyTerm, solicitationTerm]

const US_TERMS: Term[] = [
    esignTerm,
    accountOpeningPrivacyTerm,
    cardTermsIssuerTerm(LINKS.cardTermsUs),
    accuracyTerm,
    solicitationTerm,
]

const CardTermsScreen: FC<Props> = ({ isUsResident, onAccept, onPrev, submitError }) => {
    const terms = isUsResident ? US_TERMS : INT_TERMS
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)

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
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Add card" onPrev={onPrev} />

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold text-n-1">Card Terms</h1>
                <p className="text-grey-1">Please review and accept</p>
            </div>

            <ul className="flex flex-col gap-3">
                {terms.map((term) => (
                    <li key={term.id} className="flex items-start gap-3 rounded-sm border border-n-1 bg-white p-4">
                        <Checkbox
                            value={!!checked[term.id]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [term.id]: e.target.checked }))}
                            className="mt-0.5"
                        />
                        <div className="flex-1 text-sm">{term.label}</div>
                    </li>
                ))}
            </ul>

            {submitError && <p className="text-sm text-red">{submitError}</p>}

            <Button
                variant="purple"
                shadowSize="4"
                className="mt-auto w-full"
                onClick={handleContinue}
                disabled={!allAccepted || submitting}
                loading={submitting}
            >
                Continue
            </Button>
        </div>
    )
}

export default CardTermsScreen
