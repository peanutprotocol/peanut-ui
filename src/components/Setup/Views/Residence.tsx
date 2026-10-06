import { Callout } from '@/components/0_Bruddle/Callout'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Card, CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS, type Concept } from '@/components/0_Bruddle/conceptIcons'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { useSetupImageOverride } from '@/components/Setup/components/SetupWrapper'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useSetupCountrySignals } from '@/features/setup/useSetupCountrySignals'
import { setupCountrySignalProperties, setupCountrySuggestion } from '@/features/setup/country-signals'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { residenceAvailability } from '@/utils/residence-availability'
import { availableSetupFeaturesForResidence } from '@/features/setup/availableFeaturesForResidence'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import posthog from 'posthog-js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type ResidenceView = 'select' | 'restricted' | 'partial' | 'congrats'
type ResidenceStepProps = { initialView?: ResidenceView; handle?: string }
type PartialRestriction = 'card' | 'banking'

const ResidenceStep = ({ initialView }: ResidenceStepProps = {}) => {
    const t = useTranslations('setup')
    const locale = useLocale()
    const { residenceCountry, setResidenceCountry, secondResidenceCountry, setSecondResidenceCountry } =
        useSetupFlowContext()
    const { handleNext, isLoading, direction } = useSetupFlow()
    const countrySignals = useSetupCountrySignals()
    // server-authoritative tier lists with the bundled mirror as fallback
    const { sets: restrictionSets, settled: restrictionSetsSettled } = useResidenceRestrictionSetsWithStatus()

    // Stepping BACK into this step must land on the
    // screen the user actually left: a restricted pick left from its checklist,
    // so re-derive that view from the stored country. The congrats view is not
    // restored for unrestricted picks — the selector is the natural place
    // to change the answer. Forward entry and
    // deep links (direction 1 / 0) always start on the selector.
    const [view, setView] = useState<ResidenceView>(() => {
        if (initialView) return initialView
        if (direction >= 0 || !residenceCountry) return 'select'
        if (restrictionSets.full.has(residenceCountry)) return 'restricted'
        if (restrictionSets.cardOnly.has(residenceCountry) || restrictionSets.bankingOnly.has(residenceCountry)) {
            return 'partial'
        }
        return 'select'
    })
    useBackHandler(() => {
        if (!isLoading) setView('select')
        return true
    }, view !== 'select')
    const [showSecondCountry, setShowSecondCountry] = useState(!!secondResidenceCountry)
    const secondCountryId = useId()
    const featureId = useId()
    const [uncheckedFeatures, setUncheckedFeatures] = useState<string[]>([])
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
        if (restrictionSets.full.has(primary)) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN, {
                residence_country: primary,
            })
            setView('restricted')
            return
        }
        const partial: PartialRestriction | null = restrictionSets.cardOnly.has(primary)
            ? 'card'
            : restrictionSets.bankingOnly.has(primary)
              ? 'banking'
              : null
        if (partial) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN, {
                residence_country: primary,
                restriction_type: partial,
            })
            setView('partial')
            return
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN, {
            residence_country: primary,
        })
        setView('congrats')
    }

    const onContinue = () => continueWith(residenceCountry, secondResidenceCountry)

    // Picking a main residence from the compare cards promotes it and demotes
    // the other; the pair itself is unchanged, only its order.
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

    const onRestrictedContinue = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED, {
            residence_country: residenceCountry,
        })
        void handleNext()
    }

    useSetupImageOverride(view !== 'select' ? { animation: 'phone-to-phone' } : null)

    // Keep the analytics outcome aligned with updated server tiers. All
    // outcomes share the same checklist; its rows re-derive from these sets.
    useEffect(() => {
        if (view !== 'congrats') return
        if (restrictionSets.full.has(residenceCountry)) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN, {
                residence_country: residenceCountry,
            })
            setView('restricted')
            return
        }
        const partial: PartialRestriction | null = restrictionSets.cardOnly.has(residenceCountry)
            ? 'card'
            : restrictionSets.bankingOnly.has(residenceCountry)
              ? 'banking'
              : null
        if (partial) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN, {
                residence_country: residenceCountry,
                restriction_type: partial,
            })
            setView('partial')
            return
        }
    }, [restrictionSets, view, residenceCountry])

    if (view !== 'select') {
        // Until the authoritative lookup settles, show only universal
        // features. Never skip this screen or promise unconfirmed benefits.
        const { bank, card } = availableSetupFeaturesForResidence(
            restrictionSets,
            residenceCountry,
            restrictionSetsSettled
        )
        const features: { icon: IconName; concept: Concept; title: string }[] = [
            {
                icon: 'dollar',
                concept: 'balance',
                title: t('residenceStep.congrats.checklist.dollars'),
            },
            ...(bank
                ? [
                      {
                          icon: 'bank' as const,
                          concept: 'bank' as const,
                          title: t('residenceStep.congrats.checklist.banking'),
                      },
                  ]
                : []),
            ...(card
                ? [
                      {
                          icon: 'credit-card' as const,
                          concept: 'card' as const,
                          title: t('residenceStep.compare.items.card'),
                      },
                  ]
                : []),
            {
                icon: 'users',
                concept: 'friends',
                title: t('residenceStep.compare.items.p2p'),
            },
        ]
        return (
            <div className="flex h-full w-full flex-1 flex-col justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="w-full text-left text-heading-s">{t('residenceStep.congrats.title')}</h1>
                    <Card className="mt-6 px-4">
                        <ul role="list" className="divide-y divide-dashed divide-border-default">
                            {features.map((feature) => (
                                <li key={feature.title}>
                                    <DataRow
                                        compact
                                        wrapLabel
                                        label={
                                            <label
                                                htmlFor={`${featureId}-${feature.icon}`}
                                                className="flex items-center gap-3 text-foreground-primary"
                                            >
                                                <IconBubble {...CONCEPT_ICONS[feature.concept]} size="s" />
                                                <span>{feature.title}</span>
                                            </label>
                                        }
                                        value={
                                            <Checkbox
                                                id={`${featureId}-${feature.icon}`}
                                                aria-label={feature.title}
                                                value={!uncheckedFeatures.includes(feature.icon)}
                                                onChange={(event) =>
                                                    setUncheckedFeatures((previous) =>
                                                        event.target.checked
                                                            ? previous.filter((key) => key !== feature.icon)
                                                            : [...previous, feature.icon]
                                                    )
                                                }
                                            />
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    </Card>
                    <p className="mt-2 flex items-center justify-center gap-2 text-center text-body-xs text-foreground-secondary">
                        <Icon name="info" size={16} className="shrink-0" />
                        {t('choicesLater')}
                    </p>
                </div>
                <SetupFooter
                    actions={
                        <Button
                            shadowSize="4"
                            onClick={view === 'restricted' ? onRestrictedContinue : () => void handleNext()}
                            loading={isLoading}
                            disabled={isLoading}
                        >
                            {t('cta.features')}
                        </Button>
                    }
                >
                    <LinkButton className="self-center" onClick={() => setView('select')} disabled={isLoading}>
                        {t('residenceStep.restricted.changeCountry')}
                    </LinkButton>
                </SetupFooter>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-1 flex-col justify-between gap-6">
            <div className="flex w-full flex-col gap-2">
                {/* Rendered here, not by the step chrome, so the checklist
                    sub-views can replace them with their own single heading
                    (titleInView/descriptionInView on the step). */}
                <h1 className="w-full text-left text-heading-s">{t('steps.residence.title')}</h1>
                <p className="mb-6 text-body-m leading-[1.625rem] text-foreground-secondary">
                    {t('steps.residence.description')}
                </p>
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
                <div className="py-3 text-center">
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
                {/* Dual-residence comparison: facts about each residence, not a
                    menu of perks. The guidance leads with the truth norm; the
                    order is presentation only and eligibility stays with the
                    verification, so there is nothing to win by answering
                    untruthfully. Entirely client-derived (restriction tiers +
                    the same static rail map Unlock payments renders). */}
                {hasPair && (
                    <div className="mt-2 flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2">
                            {[residenceCountry, secondResidenceCountry].map((iso2) => {
                                const summary = residenceAvailability(restrictionSets, iso2)
                                const label = countryOptions.find((option) => option.value === iso2)?.label ?? iso2
                                return (
                                    <div key={iso2} className={`${CARD_SURFACE} p-3`}>
                                        <p className="mb-1 text-label-m">
                                            {t('residenceStep.compare.cardTitle', { country: label })}
                                        </p>
                                        <BulletList
                                            size="xs"
                                            items={[
                                                ...summary.available
                                                    .filter((item) => item !== 'p2p')
                                                    .map((item) => t(`residenceStep.compare.items.${item}`)),
                                                ...summary.unavailable.map((item) => (
                                                    <span key={item} className="line-through">
                                                        {t(`residenceStep.compare.missing.${item}`)}
                                                    </span>
                                                )),
                                                t('residenceStep.compare.items.p2p'),
                                            ]}
                                        />
                                        {/* One verification enrols every rail in the region's
                                                set, but a rail in another currency only pays out
                                                into an account on that network — so it is stated
                                                as a condition, not as a benefit of living here. */}
                                        {summary.multiCurrency && (
                                            <p className="mt-2 text-body-xs text-foreground-secondary">
                                                {t('residenceStep.compare.multiCurrencyNote')}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {/* The title slot is a sentence-case Body/S line; this guidance
                                labels a block of prose, so it takes the mini-header step. */}
                        <Callout priority="info" hideIcon>
                            <MiniHeader className="mb-1 text-inherit">
                                {t('residenceStep.compare.guideTitle')}
                            </MiniHeader>
                            <p>{t('residenceStep.compare.guideDeclaration')}</p>
                            <p className="mt-1">{t('residenceStep.compare.guideOrder')}</p>
                        </Callout>
                    </div>
                )}
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
                                    disabled={isLoading}
                                    loading={isLoading}
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
                            disabled={!residenceCountry || isLoading}
                            loading={isLoading}
                        >
                            {t('cta.home')}
                        </Button>
                    )
                }
            />
        </div>
    )
}

export default ResidenceStep
