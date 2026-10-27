import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupFooter from '../components/SetupFooter'
import { ResidenceCompare } from '../components/ResidenceCompare'
import { SetupCountryPicker } from '../components/SetupCountryPicker'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { REFUSED_ID_ISSUER_ISO2 } from '@/constants/residence.consts'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
import { setupCountrySignalProperties, setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type PartialRestriction = 'card' | 'banking'

/**
 * "I'm a resident of [country] and have citizenship in [the same country]."
 * A different citizenship opens a second view that compares the two countries
 * and sets Peanut up for the one picked (prototype 01, Slava 2026-10-27).
 */
const ResidenceStep = () => {
    const t = useTranslations('setup.residenceStep')
    const locale = useLocale()
    const { residenceCountry, setResidenceCountry, citizenshipCountry, setCitizenshipCountry } = useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const countrySignals = useSetupCountrySignals()
    // server-authoritative tier lists with the bundled mirror as fallback
    const { sets: restrictionSets, settled: restrictionsSettled } = useResidenceRestrictionSetsWithStatus()
    const [view, setView] = useState<'question' | 'compare'>('question')

    /*
     * The confirmed residence. The payment plan right after this step reads it
     * from the flow context, and picking the citizenship country on the
     * comparison sets it in the same click, so the effect below advances once
     * the context holds it.
     */
    const [confirmedPrimary, setConfirmedPrimary] = useState<string | null>(null)
    const advancing = isLoading || !!confirmedPrimary
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)
    const prefillSourceRef = useRef<string | null>(null)

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])
    const labelOf = (iso2: string) => countryOptions.find((option) => option.value === iso2)?.label ?? iso2

    // The geo guess, only if it is actually offered in the list.
    const geoSuggestion = useMemo(() => {
        return setupCountrySuggestion(
            countrySignals,
            countryOptions.map((option) => option.value)
        )
    }, [countrySignals, countryOptions])

    // Geo is a suggestion only: preselect the residence when nothing is chosen
    // yet, never auto-advance, and never trigger the restricted screen from it.
    useEffect(() => {
        if (residenceCountry || !geoSuggestion) return
        wasPrefilledRef.current = true
        prefillSourceRef.current = geoSuggestion.source
        setResidenceCountry(geoSuggestion.country)
    }, [geoSuggestion, residenceCountry, setResidenceCountry])

    // Falls back to the suggestion for the one frame before the effect above commits it.
    const residence = residenceCountry || geoSuggestion?.country || ''
    const citizenship = citizenshipCountry && citizenshipCountry !== residence ? citizenshipCountry : ''
    const refusedPassport =
        !!citizenship && REFUSED_ID_ISSUER_ISO2.has(citizenship) && !REFUSED_ID_ISSUER_ISO2.has(residence)

    useBackHandler(() => {
        setView('question')
        return true
    }, view === 'compare')

    const continueWith = (primary: string) => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED, {
            residence_country: primary,
            citizenship_differs: !!citizenship,
            compared: view === 'compare',
            was_prefilled: wasPrefilledRef.current,
            geo_country: countrySignals.ipCountry || undefined,
            residence_prefill_source: wasPrefilledRef.current ? prefillSourceRef.current : null,
            ...setupCountrySignalProperties(countrySignals),
        })
        // The outcome events name what the payment plan will offer for this residence.
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
        setConfirmedPrimary(primary)
    }

    useEffect(() => {
        if (!confirmedPrimary || residenceCountry !== confirmedPrimary) return
        setConfirmedPrimary(null)
        void handleNext()
    }, [confirmedPrimary, residenceCountry, handleNext])

    const onContinue = () => {
        if (!residence) return
        if (citizenship) setView('compare')
        else continueWith(residence)
    }

    // Picking the citizenship country sets Peanut up there; the citizenship answer stays.
    const onChoose = (country: string) => {
        if (country !== residenceCountry) {
            wasPrefilledRef.current = false
            setResidenceCountry(country)
        }
        continueWith(country)
    }

    if (view === 'compare' && citizenship)
        return (
            <ResidenceCompare
                residence={residence}
                citizenship={citizenship}
                labelOf={labelOf}
                restrictionSets={restrictionSets}
                restrictionsSettled={restrictionsSettled}
                busy={advancing}
                onChoose={onChoose}
            />
        )

    return (
        <div className="flex w-full flex-1 flex-col gap-8 compact:gap-4">
            <h1 className="text-heading-m leading-[2.75rem] compact:text-heading-s compact:leading-[2.5rem] tight:leading-[2.25rem]">
                {t.rich('sentence', {
                    nw: (chunks) => <span className="inline-block max-w-full whitespace-nowrap">{chunks}</span>,
                    residence: () => (
                        <SetupCountryPicker
                            title={t('residenceTitle')}
                            value={residence}
                            options={countryOptions}
                            testId="setup-residence-country"
                            onChange={(country) => {
                                wasPrefilledRef.current = false
                                setResidenceCountry(country)
                            }}
                        />
                    ),
                    citizenship: () => (
                        <SetupCountryPicker
                            title={t('citizenshipTitle')}
                            value={citizenship}
                            same={residence}
                            options={countryOptions}
                            testId="setup-citizenship-country"
                            onChange={setCitizenshipCountry}
                        />
                    ),
                })}
            </h1>
            {refusedPassport ? (
                <Callout priority="attention">
                    {t('refusedPassport', { citizenship: labelOf(citizenship), residence: labelOf(residence) })}
                </Callout>
            ) : (
                <p className="flex items-start gap-2 text-body-s leading-5 text-foreground-secondary">
                    <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                    {t('hint')}
                </p>
            )}
            <SetupFooter
                actions={
                    <Button
                        shadowSize="4"
                        className="w-full"
                        data-testid="setup-residence-continue"
                        onClick={onContinue}
                        disabled={!residence || advancing}
                        loading={advancing}
                    >
                        {t('continue')}
                    </Button>
                }
            />
        </div>
    )
}

export default ResidenceStep
