'use client'

import { type ReactNode, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import type { ResidenceCountryOption } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { CountryPill } from './CountryPill'
import { longestLabel, useSentenceFit } from './useSentenceFit'

type Sheet = 'open' | 'no-results' | null

/**
 * The 07 sentence in the white panel, prod's wording (v7: nationality is a legal term): "I'm a resident of [residence]
 * and hold the nationality of [nationality]." with two country pills. Under it the refused-passport callout, or else
 * the screen's helper line when it has one.
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
    helper,
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
    /** The line under the sentence when no callout shows; measured with it, so the pair never runs under the CTA. */
    helper: ReactNode
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
    return (
        // With the callout, a three-line sentence on a 320 phone leaves no room for five callout lines, and the small
        // sentence size is the regular size there. So the block stops 16 px (CTA_GAP) above the button and scrolls
        // rather than running under it (review R2-05).
        <div
            className={refusedPassport ? 'max-h-[calc(var(--sr-panel-to-cta)-16px)] overflow-y-auto' : undefined}
            data-residence-scroll
        >
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
                {refusedPassport ? (
                    <Callout priority="attention" className="mt-3 signup-sm:mt-1.5">
                        {t('refusedPassport', { nationality: labelOf(nationality), residence: labelOf(residence) })}
                    </Callout>
                ) : (
                    helper
                )}
            </div>
        </div>
    )
}
