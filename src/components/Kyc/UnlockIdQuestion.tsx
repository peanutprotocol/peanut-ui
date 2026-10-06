'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useId, useMemo } from 'react'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import { localizedCountryName } from '@/utils/country-name.utils'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { residenceCopyVariant } from './unlock-checklist.utils'
import { type IdDocumentAnswer, type useUnlockChecklist } from './useUnlockChecklist'

interface UnlockIdQuestionProps {
    /** ISO-2 declared residence: the country the first answer names. */
    residence: string
    /** The answer and its setters, from the hook that re-queries on it. */
    checklist: Pick<
        ReturnType<typeof useUnlockChecklist>,
        'document' | 'setDocument' | 'foreignIdCountry' | 'setForeignIdCountry'
    >
}

/**
 * "Which ID to use?" (TASK-23329): an ID issued by the residence country, or
 * one issued by another country with its issuing country. One question for
 * the unlock checklist and the method unlock sheet; useUnlockChecklist holds
 * the answer and re-queries what it can unlock.
 */
export const UnlockIdQuestion = ({ residence, checklist }: UnlockIdQuestionProps) => {
    const t = useTranslations('kyc.unlock')
    const locale = useLocale()
    const questionId = useId()
    const country = localizedCountryName(locale, residence, residence)
    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const answers: Array<{ id: IdDocumentAnswer; label: string }> = [
        { id: 'local', label: t(`idLocal.${residenceCopyVariant(residence)}`, { country }) },
        { id: 'foreign', label: t('idForeign') },
    ]

    return (
        <div className="flex flex-col gap-2">
            <p id={questionId} className="text-label-l">
                {t('idQuestion')}
            </p>
            {/* selected = fill + check, as the token rows (design.md "selected list
                rows"); the radio semantics ride a wrapper because ListItem forwards no
                role, the same hold as TokenListItem */}
            <div role="radiogroup" aria-labelledby={questionId} className="flex flex-col">
                {answers.map((answer, index) => {
                    const selected = checklist.document === answer.id
                    const paint = selected ? 'text-foreground-over-color-primary' : undefined
                    const choose = () => checklist.setDocument(answer.id)
                    return (
                        <div
                            key={answer.id}
                            role="radio"
                            aria-checked={selected}
                            tabIndex={0}
                            onClick={choose}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                event.preventDefault()
                                choose()
                            }}
                            className="cursor-pointer focus-visible:outline-[3px] focus-visible:outline-action-focus"
                        >
                            <ListItem
                                position={getCardPosition(index, answers.length)}
                                className={twMerge(
                                    'transition-colors duration-instant',
                                    selected && 'bg-action-primary'
                                )}
                                title={<span className={paint}>{answer.label}</span>}
                                trailing={selected ? <Icon name="check" size={20} className={paint} /> : undefined}
                            />
                        </div>
                    )
                })}
            </div>
            {checklist.document === 'foreign' && (
                <CountryCombobox
                    options={countryOptions}
                    placeholder={t('foreignIdCountryPlaceholder')}
                    aria-label={t('foreignIdCountryPlaceholder')}
                    value={checklist.foreignIdCountry}
                    onValueChange={checklist.setForeignIdCountry}
                />
            )}
        </div>
    )
}
