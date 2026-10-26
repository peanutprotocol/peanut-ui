import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
import { setupCountrySignalProperties, setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import posthog from 'posthog-js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type PartialRestriction = 'card' | 'banking'

const ResidenceStep = () => {
    const t = useTranslations('setup')
    const locale = useLocale()
    const { residenceCountry, setResidenceCountry, secondResidenceCountry, setSecondResidenceCountry } =
        useSetupFlowContext()
    const { handleNext, isLoading } = useSetupFlow()
    const countrySignals = useSetupCountrySignals()
    // server-authoritative tier lists with the bundled mirror as fallback
    const { sets: restrictionSets } = useResidenceRestrictionSetsWithStatus()

    const [showSecondCountry, setShowSecondCountry] = useState(!!secondResidenceCountry)
    /*
     * The confirmed primary residence. The payment plan right after this step
     * reads it from the flow context. Advancing in the same click (the
     * dual-residence "Select <country>" buttons promote and continue at once)
     * would reach the plan before the new residence lands. So Confirm records
     * the choice and the effect below advances once the context holds it.
     */
    const [confirmedPrimary, setConfirmedPrimary] = useState<string | null>(null)
    const advancing = isLoading || !!confirmedPrimary
    const secondCountryId = useId()
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)
    const prefillSourceRef = useRef<string | null>(null)

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])

    // a declared pair: two distinct countries, both on screen
    const hasPair =
        showSecondCountry &&
        !!residenceCountry &&
        !!secondResidenceCountry &&
        residenceCountry !== secondResidenceCountry

    // The geo guess, only if it is actually offered in the list.
    const geoSuggestion = useMemo(() => {
        return setupCountrySuggestion(
            countrySignals,
            countryOptions.map((option) => option.value)
        )
    }, [countrySignals, countryOptions])

    // Geo is a suggestion only: preselect the dropdown when nothing is chosen
    // yet, never auto-advance, and never trigger the restricted screen from it.
    useEffect(() => {
        if (residenceCountry || !geoSuggestion) return
        wasPrefilledRef.current = true
        prefillSourceRef.current = geoSuggestion.source
        setResidenceCountry(geoSuggestion.country)
    }, [geoSuggestion, residenceCountry, setResidenceCountry])

    const onResidenceChange = (value: string) => {
        wasPrefilledRef.current = false
        setResidenceCountry(value)
    }

    // The picked primary is passed in, not read off the store: the dual-residence
    // "Select <country>" buttons dispatch the promotion and continue in the same
    // handler, so the store value this render closed over is a step behind.
    const continueWith = (primary: string, second: string) => {
        if (!primary) return
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED, {
            residence_country: primary,
            second_residence_country: second || undefined,
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

    const onContinue = () => continueWith(residenceCountry, secondResidenceCountry)

    // Picking a main residence with its "Select <country>" button promotes it
    // and demotes the other; the pair itself is unchanged, only its order.
    const onSelectPrimary = (primary: string) => {
        const second = primary === residenceCountry ? secondResidenceCountry : residenceCountry
        if (primary !== residenceCountry) {
            wasPrefilledRef.current = false
            setResidenceCountry(primary)
            setSecondResidenceCountry(second)
        }
        continueWith(primary, second)
    }

    // Clearing one half of a declared pair leaves the other as the sole
    // residence, back on the single-country selector.
    const onRemoveCountry = (removed: 'primary' | 'second') => {
        if (removed === 'primary') {
            // the promoted country was typed, not suggested — leaving the flag set
            // would attribute it to the geo guess for the rest of the step
            wasPrefilledRef.current = false
            setResidenceCountry(secondResidenceCountry)
        }
        setSecondResidenceCountry('')
        setShowSecondCountry(false)
    }

    return (
        <div className="flex h-full w-full flex-1 flex-col justify-between gap-6">
            <div className="flex w-full flex-col gap-2">
                <CountryCombobox
                    options={countryOptions}
                    placeholder={t('residenceStep.countryPlaceholder')}
                    // Falls back to the suggestion for the one frame between
                    // mount and the effect below committing it, so the field
                    // opens already filled instead of visibly changing itself.
                    value={residenceCountry || geoSuggestion?.country}
                    onValueChange={onResidenceChange}
                    onClear={hasPair ? () => onRemoveCountry('primary') : undefined}
                />
                <div className="py-3 text-center compact:py-1 tight:py-0">
                    <LinkButton
                        aria-expanded={showSecondCountry}
                        aria-controls={secondCountryId}
                        onClick={() => {
                            // An invisible second residence must not be persisted.
                            if (showSecondCountry && secondResidenceCountry) setSecondResidenceCountry('')
                            setShowSecondCountry(!showSecondCountry)
                        }}
                    >
                        {t('residenceStep.multiDocLink')}
                    </LinkButton>
                </div>
                <div id={secondCountryId}>
                    {showSecondCountry && (
                        <CountryCombobox
                            options={countryOptions}
                            placeholder={t('residenceStep.secondCountryPlaceholder')}
                            value={secondResidenceCountry || undefined}
                            onValueChange={(value) => setSecondResidenceCountry(value)}
                            onClear={hasPair ? () => onRemoveCountry('second') : undefined}
                        />
                    )}
                </div>
            </div>
            {/* One button per declared country: the tap IS the main-residence
                declaration, so there is no separate order control to get wrong. */}
            <SetupFooter
                actions={
                    hasPair ? (
                        <div className="flex w-full flex-col gap-3">
                            {[secondResidenceCountry, residenceCountry].map((iso2) => (
                                <Button
                                    key={iso2}
                                    shadowSize="4"
                                    variant={iso2 === residenceCountry ? 'primary' : 'secondary'}
                                    onClick={() => onSelectPrimary(iso2)}
                                    disabled={advancing}
                                    loading={advancing}
                                >
                                    {t('residenceStep.compare.selectCountry', {
                                        country: countryOptions.find((option) => option.value === iso2)?.label ?? iso2,
                                    })}
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <Button
                            shadowSize="4"
                            onClick={onContinue}
                            disabled={!residenceCountry || advancing}
                            loading={advancing}
                        >
                            {t('cta.confirm')}
                        </Button>
                    )
                }
            />
        </div>
    )
}

export default ResidenceStep
