'use client'

import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ResidenceHero } from '@/components/Setup/components/ResidenceHero'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { StarDoodles, type StarSpec } from '@/components/Setup/redesign/shell/StarDoodles'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import type { SetupStageSize } from '@/components/Setup/redesign/shell/shell.types'
import { DESIGN_STAGE_PX } from '@/components/Setup/redesign/shell/useArtScale'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { setupCountrySignalProperties, setupCountrySuggestion } from '@/features/setup/country-signals'
import { saveSignupResidence } from '@/features/setup/saveSignupAnswers'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { ResidenceCompareView } from './ResidenceCompareView'
import { ResidenceSentence } from './ResidenceSentence'
import { ResidenceWhyLink } from './ResidenceWhyLink'
import { useCompareColumns } from './useCompareColumns'

type PartialRestriction = 'card' | 'banking'
type Sheet = 'open' | 'no-results' | null

/**
 * Where the hero box starts in the art box (design px): it runs from under the headline to the seam, so dev's
 * ResidenceHero (ruling 5) stands its mascot on the seam. Small phones start lower; the compact stage (the 320
 * refused-passport state) is shorter.
 */
const HERO_TOP = { std: 150, sm: 190, compact: 120 }
/** The compare stage has no mascot (ruling 5, K4); the mock's two stars stay. */
const COMPARE_STARS: readonly StarSpec[] = [
    { left: 254, top: 250, size: 18 },
    { left: 238, top: 186, size: 16, sparkle: true },
]

/**
 * 07 Residence (step `residence`): "My residence is in [X], my nationality is [Y]." in the white panel, dev's country-sticker hero on
 * the stage. A different nationality opens the compare view, which sets Peanut up for the country picked. Behaviour,
 * saves and analytics as dev's Residence view.
 */
export function ResidenceScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const tWrapper = useTranslations('setup.wrapper')
    const locale = useLocale()
    const { residenceCountry, setResidenceCountry, nationalityCountry, setNationalityCountry, onFinish } =
        useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const { user } = useAuth()
    const countrySignals = useSetupCountrySignals()
    const { sets: restrictionSets, settled: setsSettled } = useResidenceRestrictionSetsWithStatus()
    const { track, trackError } = useSignupControl()
    const device = useShellDevice()
    const [view, setView] = useState<'sentence' | 'compare'>('sentence')
    const [residenceSheet, setResidenceSheet] = useState<Sheet>(null)
    const [nationalitySheet, setNationalitySheet] = useState<Sheet>(null)

    // The confirmed residence: the payment plan reads it from the context, so the step advances once it is there.
    const [confirmedPrimary, setConfirmedPrimary] = useState<string | null>(null)
    const advancing = isLoading || !!confirmedPrimary
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)
    const prefillSourceRef = useRef<string | null>(null)

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const labelOf = (iso2: string) => countryOptions.find((option) => option.value === iso2)?.label ?? iso2

    // The geo guess, only if it is offered in the list.
    const geoSuggestion = useMemo(
        () =>
            setupCountrySuggestion(
                countrySignals,
                countryOptions.map((option) => option.value)
            ),
        [countrySignals, countryOptions]
    )

    // Geo only suggests: preselect the residence when nothing is chosen, never auto-advance.
    useEffect(() => {
        if (residenceCountry || !geoSuggestion) return
        wasPrefilledRef.current = true
        prefillSourceRef.current = geoSuggestion.source
        setResidenceCountry(geoSuggestion.country)
    }, [geoSuggestion, residenceCountry, setResidenceCountry])

    // Falls back to the suggestion for the one frame before the effect above commits it.
    const residence = residenceCountry || geoSuggestion?.country || ''
    const nationality = nationalityCountry && nationalityCountry !== residence ? nationalityCountry : ''
    const refusedPassport =
        !!nationality &&
        !!restrictionSets &&
        restrictionSets.refusedIdIssuers.has(nationality) &&
        !restrictionSets.refusedIdIssuers.has(residence)

    useEffect(() => {
        trackError('nationality_country', refusedPassport ? 'refused_issuer' : null)
    }, [refusedPassport, trackError])

    const comparing = view === 'compare' && !!nationality
    const compare = useCompareColumns(residence, nationality, restrictionSets, setsSettled)

    // Back on compare returns to the sentence; on the sentence the stepper owns Back.
    useBackHandler(() => {
        track('residence_compare', 'dismiss')
        setView('sentence')
        return true
    }, comparing)

    const continueWith = (primary: string) => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED, {
            residence_country: primary,
            nationality_differs: !!nationality,
            compared: comparing,
            was_prefilled: wasPrefilledRef.current,
            geo_country: countrySignals.ipCountry || undefined,
            residence_prefill_source: wasPrefilledRef.current ? prefillSourceRef.current : null,
            ...setupCountrySignalProperties(countrySignals),
        })
        // The outcome events name what the payment plan will offer for this residence.
        if (restrictionSets) {
            const partial: PartialRestriction | null = restrictionSets.cardOnly.has(primary)
                ? 'card'
                : restrictionSets.bankingOnly.has(primary)
                  ? 'banking'
                  : null
            if (restrictionSets.full.has(primary)) {
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN, { residence_country: primary })
            } else if (partial) {
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN, {
                    residence_country: primary,
                    restriction_type: partial,
                })
            } else {
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN, { residence_country: primary })
            }
        }
        // Signed in: save on Next, not awaited. The verify prelude (onFinish) saves the answers itself.
        // Before the account exists the draft carries them and bindSignupDraft saves them after registration.
        const userId = user?.user?.userId
        if (userId && !onFinish) saveSignupResidence(userId, primary, nationalityCountry || primary)
        setConfirmedPrimary(primary)
    }

    useEffect(() => {
        if (!confirmedPrimary || residenceCountry !== confirmedPrimary) return
        setConfirmedPrimary(null)
        void handleNext()
    }, [confirmedPrimary, residenceCountry, handleNext])

    const onContinue = () => {
        if (!residence) return
        track('continue', 'tap')
        if (nationality) {
            track('residence_compare', 'open')
            setView('compare')
        } else continueWith(residence)
    }

    // Picking the nationality country sets Peanut up there; the nationality answer stays.
    const onChoose = (country: string) => {
        track('compare_choice', 'tap', country === residence ? 'residence' : 'nationality')
        if (country !== residenceCountry) {
            wasPrefilledRef.current = false
            setResidenceCountry(country)
        }
        continueWith(country)
    }

    const sheet = residenceSheet ?? nationalitySheet
    const state = advancing
        ? 'advancing'
        : comparing
          ? compare.state
          : sheet === 'no-results'
            ? 'search-empty'
            : residenceSheet
              ? 'picker'
              : nationalitySheet
                ? 'picker-nationality'
                : refusedPassport
                  ? 'refused-passport'
                  : !residence
                    ? 'empty'
                    : nationality
                      ? 'differ'
                      : 'default'
    const stage: SetupStageSize = comparing || (refusedPassport && device === 'sm') ? 'compact' : 'std'
    const heroTop = stage === 'compact' ? HERO_TOP.compact : HERO_TOP[device]
    const selectButton = (iso2: string) => ({
        label: t('residence.select', { country: labelOf(iso2) }),
        onClick: () => onChoose(iso2),
        disabled: advancing,
        loading: advancing,
        testId: `setup-residence-select-${iso2}`,
    })

    // "Why do we ask?" under Continue (v7). The refused-passport callout leaves no room for it (v7 resrestricted).
    const whyLink = refusedPassport ? null : <ResidenceWhyLink />

    if (comparing)
        return (
            <SetupScreen
                ground="pink"
                stage="compact"
                artTop={186}
                state={state}
                title={t('residence.compareTitle')}
                art={<StarDoodles stars={COMPARE_STARS} />}
                footer={{ primary: selectButton(residence), secondary: selectButton(nationality) }}
            >
                <ResidenceCompareView columns={compare.columns} labelOf={labelOf} currencyNote={compare.currencyNote} />
            </SetupScreen>
        )

    return (
        <SetupScreen
            ground="pink"
            stage={stage}
            artTop={heroTop}
            smArtTop={heroTop}
            state={state}
            title={t('residence.sheetResidence')}
            art={
                <div
                    className="absolute left-0 w-full"
                    style={{ top: heroTop, height: DESIGN_STAGE_PX[stage] - heroTop }}
                    data-residence-hero-box
                >
                    <ResidenceHero alt={tWrapper('illustrationAlt')} />
                </div>
            }
            footer={{
                primary: {
                    label: t('common.continue'),
                    onClick: onContinue,
                    disabled: !residence || advancing,
                    loading: advancing,
                    testId: 'setup-residence-continue',
                },
                slot: whyLink ?? undefined,
            }}
        >
            <ResidenceSentence
                residence={residence}
                nationality={nationality}
                options={countryOptions}
                labelOf={labelOf}
                refusedPassport={refusedPassport}
                onResidence={(country) => {
                    wasPrefilledRef.current = false
                    setResidenceCountry(country)
                }}
                onNationality={setNationalityCountry}
                onResidenceSheet={setResidenceSheet}
                onNationalitySheet={setNationalitySheet}
            />
        </SetupScreen>
    )
}
