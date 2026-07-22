'use client'
import { type FC, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'

interface Props {
    /** ISO-2 codes the backend derived from the applicant's own evidence. */
    candidates: string[]
    onConfirm: (countryCode: string) => void | Promise<void>
    /** Rendered when `candidates` is empty — neither signal was usable. */
    onContactSupport: () => void
    onPrev?: () => void
    submitError?: string | null
}

/** "BR" → "Brazil", falling back to the raw code for anything unmappable. */
const countryName = (iso2: string, locale: string): string => {
    try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(iso2) ?? iso2
    } catch {
        return iso2
    }
}

/**
 * Shown when the backend detects conflicting residence evidence on the card
 * application (Sumsub address country vs ID-document country — see
 * `country-confirmation-required` in services/rain.ts). The user picks where
 * they live; the pick is persisted server-side so this is asked at most once.
 */
const CardCountryConfirmScreen: FC<Props> = ({ candidates, onConfirm, onContactSupport, onPrev, submitError }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const locale = useLocale()
    const [selected, setSelected] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_COUNTRY_CONFIRM_VIEWED, {
            candidates,
        })
    }, [candidates])

    const handleContinue = async () => {
        if (!selected) return
        setSubmitting(true)
        try {
            await onConfirm(selected)
        } finally {
            setSubmitting(false)
        }
    }

    if (candidates.length === 0) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-6">
                <NavHeader title={t('navAddCard')} onPrev={onPrev} />
                <div className="my-auto flex flex-col items-center gap-3 text-center">
                    <h1 className="text-2xl font-extrabold text-n-1">{t('countryConfirm.noCandidatesTitle')}</h1>
                    <p className="text-grey-1">{t('countryConfirm.noCandidatesBody')}</p>
                    <button type="button" onClick={onContactSupport} className="text-black underline">
                        {tCommon('contactSupport')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title={t('navAddCard')} onPrev={onPrev} />

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold text-n-1">{t('countryConfirm.title')}</h1>
                <p className="text-grey-1">{t('countryConfirm.description')}</p>
            </div>

            <ul className="flex flex-col gap-3">
                {candidates.map((iso2) => (
                    <li key={iso2}>
                        <button
                            type="button"
                            onClick={() => setSelected(iso2)}
                            aria-pressed={selected === iso2}
                            className={`w-full rounded-sm border border-n-1 p-4 text-left text-sm font-semibold ${
                                selected === iso2 ? 'bg-primary-3' : 'bg-white'
                            }`}
                        >
                            {countryName(iso2, locale)}
                        </button>
                    </li>
                ))}
            </ul>

            {submitError && <p className="text-sm text-red">{submitError}</p>}

            <Button
                variant="purple"
                shadowSize="4"
                className="mt-auto w-full"
                onClick={handleContinue}
                disabled={!selected || submitting}
                loading={submitting}
            >
                {tCommon('continue')}
            </Button>
        </div>
    )
}

export default CardCountryConfirmScreen
