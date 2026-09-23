'use client'
import { type FC, useEffect, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useLocale, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { localizedCountryName } from '@/utils/country-name.utils'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

interface Props {
    /** ISO-2 codes the backend derived from the applicant's own evidence. */
    candidates: string[]
    onConfirm: (countryCode: string) => void | Promise<void>
    /** Rendered when `candidates` is empty — neither signal was usable. */
    onContactSupport: () => void
    onPrev?: () => void
    submitError?: string | null
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
            <PageStack gap="6">
                <NavHeader title={t('navAddCard')} onPrev={onPrev} />
                <div className="my-auto flex flex-col items-center gap-3 text-center">
                    <h1 className="text-heading-s text-foreground-primary">{t('countryConfirm.noCandidatesTitle')}</h1>
                    <p className="text-foreground-secondary">{t('countryConfirm.noCandidatesBody')}</p>
                    <LinkButton onClick={onContactSupport}>{tCommon('contactSupport')}</LinkButton>
                </div>
            </PageStack>
        )
    }

    return (
        <PageStack gap="6">
            <NavHeader title={t('navAddCard')} onPrev={onPrev} />

            <div className="flex flex-col gap-2">
                <h1 className="text-heading-s text-foreground-primary">{t('countryConfirm.title')}</h1>
                <p className="text-foreground-secondary">{t('countryConfirm.description')}</p>
            </div>

            {/* selected-row rule (design.md): fill + over-colour text + trailing check.
                ListItem forwards no role or aria state, so the radio semantics ride a
                wrapper, the same way TokenListItem carries its option semantics. */}
            <div role="radiogroup" aria-label={t('countryConfirm.title')}>
                {candidates.map((iso2, index) => {
                    const isSelected = selected === iso2
                    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined
                    return (
                        <div
                            key={iso2}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onClick={() => setSelected(iso2)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                event.preventDefault()
                                setSelected(iso2)
                            }}
                            className="cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus"
                        >
                            <ListItem
                                position={getCardPosition(index, candidates.length)}
                                className={twMerge(
                                    'transition-colors duration-instant active:bg-background-disabled',
                                    isSelected && 'bg-action-primary'
                                )}
                                title={
                                    <span className={twMerge('block truncate', paint)}>
                                        {localizedCountryName(locale, iso2, iso2)}
                                    </span>
                                }
                                trailing={isSelected && <Icon name="check" size={20} className={paint} />}
                            />
                        </div>
                    )
                })}
            </div>

            {submitError && <p className="text-body-s text-foreground-error">{submitError}</p>}

            <Button
                variant="primary"
                shadowSize="4"
                className="mt-auto w-full"
                onClick={handleContinue}
                disabled={!selected || submitting}
                loading={submitting}
            >
                {tCommon('continue')}
            </Button>
        </PageStack>
    )
}

export default CardCountryConfirmScreen
