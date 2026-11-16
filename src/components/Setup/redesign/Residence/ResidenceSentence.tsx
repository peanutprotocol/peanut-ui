'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import type { ResidenceCountryOption } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { CountryPill } from './CountryPill'
import { useSentenceFit } from './useSentenceFit'

type Sheet = 'open' | 'no-results' | null

/**
 * The 07 sentence in the white panel: "I live in [residence] and I'm from [nationality]." with two country pills,
 * and the refused-passport callout under it. No hint line.
 */
export function ResidenceSentence({
    residence,
    nationality,
    options,
    labelOf,
    refusedPassport,
    onResidence,
    onNationality,
    onResidenceSheet,
    onNationalitySheet,
}: {
    residence: string
    nationality: string
    options: ResidenceCountryOption[]
    labelOf: (iso2: string) => string
    refusedPassport: boolean
    onResidence: (country: string) => void
    onNationality: (country: string) => void
    onResidenceSheet: (sheet: Sheet) => void
    onNationalitySheet: (sheet: Sheet) => void
}) {
    const t = useTranslations('setupRedesign.residence')
    const blockRef = useRef<HTMLDivElement>(null)
    const sentenceClass = useSentenceFit(blockRef, refusedPassport)
    return (
        <div ref={blockRef} data-setup-screen="residence">
            <p className={twMerge('[text-wrap:pretty] text-foreground-primary', sentenceClass)}>
                {t.rich('sentence', {
                    nw: (chunks) => (
                        <span className="inline-flex max-w-full items-center align-middle whitespace-nowrap">
                            {chunks}
                        </span>
                    ),
                    residence: () => (
                        <CountryPill
                            title={t('sheetResidence')}
                            value={residence}
                            options={options}
                            testId="setup-residence-country"
                            control="residence_country"
                            onChange={onResidence}
                            onSheetChange={onResidenceSheet}
                        />
                    ),
                    nationality: () => (
                        <CountryPill
                            title={t('sheetNationality')}
                            value={nationality}
                            same={residence}
                            options={options}
                            testId="setup-nationality-country"
                            control="nationality_country"
                            onChange={onNationality}
                            onSheetChange={onNationalitySheet}
                        />
                    ),
                })}
            </p>
            {refusedPassport && (
                <Callout priority="attention" className="mt-3 signup-sm:mt-1.5">
                    {t('refusedPassport', { nationality: labelOf(nationality), residence: labelOf(residence) })}
                </Callout>
            )}
        </div>
    )
}
