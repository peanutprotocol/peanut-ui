'use client'
import { type FC, type ReactNode, useMemo, useState } from 'react'
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

const LINKS = {
    eSign: 'https://legal.raincards.xyz/legal/electronic-communications-notice',
    issuerPrivacy: 'https://www.third-national.com/privacypolicy',
    // TODO: swap placeholders with the real links when Rain/partner share them.
    cardTerms: '#',
    accountOpeningPrivacy: '#',
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

const INT_TERMS: Term[] = [
    {
        id: 'esign',
        label: (
            <>
                I accept the <ExternalLink href={LINKS.eSign}>E-Sign Consent</ExternalLink>
            </>
        ),
    },
    {
        id: 'cardTermsIssuer',
        label: (
            <>
                I accept the <ExternalLink href={LINKS.cardTerms}>{CARD_PARTNER_NAME} Card Terms</ExternalLink>
                {', and the '}
                <ExternalLink href={LINKS.issuerPrivacy}>Issuer Privacy Policy</ExternalLink>
            </>
        ),
    },
    {
        id: 'accuracy',
        label: `I certify that the information I have provided is accurate and that I will abide by all the rules and requirements related to my ${CARD_PARTNER_NAME} Spend Card.`,
    },
    {
        id: 'solicitation',
        label: `I acknowledge that applying for the ${CARD_PARTNER_NAME} Spend Card does not constitute unauthorized solicitation.`,
    },
]

const US_TERMS: Term[] = [
    INT_TERMS[0],
    {
        id: 'accountOpeningPrivacy',
        label: (
            <>
                I accept the{' '}
                <ExternalLink href={LINKS.accountOpeningPrivacy}>Account Opening Privacy Notice</ExternalLink>
            </>
        ),
    },
    INT_TERMS[1],
    INT_TERMS[2],
    INT_TERMS[3],
]

const CardTermsScreen: FC<Props> = ({ isUsResident, onAccept, onPrev, submitError }) => {
    const terms = isUsResident ? US_TERMS : INT_TERMS
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)

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
