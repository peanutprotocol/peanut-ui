'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import type { ResidenceCountryOption } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { CountryPill } from './CountryPill'
import { longestLabel, useSentenceFit } from './useSentenceFit'

type Sheet = 'open' | 'no-results' | null

/**
 * The 07 sentence in the white panel: "My residence is in [residence], my nationality is [nationality]." with two country pills,
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
    // either pill can hold any offered country, so the longest name is the worst case for both
    const longest = longestLabel(options.map((option) => option.label))
    const sentenceClass = useSentenceFit(blockRef, {
        worst: { residence_country: longest, nationality_country: longest },
        remeasure: refusedPassport,
        fitLabels: false,
    })
    // The callout can run past the footer on a short phone; the shell lifts the stage for it (useShellFit).
    return (
        <div ref={blockRef} data-setup-screen="residence">
            <p className={twMerge('[text-wrap:pretty] text-foreground-primary', sentenceClass)}>
                {t.rich('sentence', {
                    nw: (chunks) => (
                        <span
                            className="inline-flex max-w-full items-center align-middle whitespace-nowrap"
                            data-fit-group
                        >
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
                <Callout priority="attention" className="mt-3 signup-sm:mt-2">
                    {t('refusedPassport', { nationality: labelOf(nationality), residence: labelOf(residence) })}
                </Callout>
            )}
        </div>
    )
}
