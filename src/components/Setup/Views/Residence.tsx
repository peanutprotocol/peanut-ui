import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useResidenceRestrictionSets } from '@/hooks/useResidenceRestrictionSets'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { isValidEmail } from '@/utils/format.utils'
import { residenceAvailability } from '@/utils/residence-availability'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type ResidenceView = 'select' | 'restricted' | 'notify' | 'notify-done' | 'partial'
type PartialRestriction = 'card' | 'banking'

const ResidenceStep = () => {
    const t = useTranslations('setup')
    const locale = useLocale()
    const dispatch = useAppDispatch()
    const { residenceCountry, secondResidenceCountry } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { countryCode: geoCountryCode } = useGeoLocation()
    // server-authoritative tier lists with the bundled mirror as fallback
    const restrictionSets = useResidenceRestrictionSets()

    const [view, setView] = useState<ResidenceView>('select')
    const [partialRestriction, setPartialRestriction] = useState<PartialRestriction>('card')
    const [showSecondCountry, setShowSecondCountry] = useState(!!secondResidenceCountry)
    const [email, setEmail] = useState('')
    const [emailError, setEmailError] = useState('')
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])

    // Geo is a suggestion only: preselect the dropdown when nothing is chosen
    // yet, never auto-advance, and never trigger the restricted screen from it.
    useEffect(() => {
        if (residenceCountry || !geoCountryCode) return
        const suggested = geoCountryCode.toUpperCase()
        if (countryOptions.some((o) => o.value === suggested)) {
            wasPrefilledRef.current = true
            dispatch(setupActions.setResidenceCountry(suggested))
        }
    }, [geoCountryCode, residenceCountry, countryOptions, dispatch])

    const onResidenceChange = (value: string) => {
        wasPrefilledRef.current = false
        dispatch(setupActions.setResidenceCountry(value))
    }

    const onContinue = () => {
        if (!residenceCountry) return
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED, {
            residence_country: residenceCountry,
            second_residence_country: secondResidenceCountry || undefined,
            was_prefilled: wasPrefilledRef.current,
            geo_country: geoCountryCode?.toUpperCase() || undefined,
        })
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
            setPartialRestriction(partial)
            setView('partial')
            return
        }
        void handleNext()
    }

    const onRestrictedContinue = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED, {
            residence_country: residenceCountry,
        })
        void handleNext()
    }

    const onNotifySubmit = () => {
        if (!isValidEmail(email)) {
            setEmailError(t('residenceStep.errors.invalidEmail'))
            return
        }
        setEmailError('')
        // No account exists yet, so the contact lives on the PostHog person
        // until a pre-account waitlist endpoint exists.
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_NOTIFY_SUBMITTED, {
            residence_country: residenceCountry,
        })
        posthog.setPersonProperties({
            residence_notify_email: email,
            residence_notify_country: residenceCountry,
        })
        setView('notify-done')
    }

    if (view === 'partial') {
        return (
            <div className="flex h-full w-full flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-heading-xs font-extrabold">{t('residenceStep.partial.title')}</h2>
                    <p className="text-body-s text-foreground-secondary">
                        {partialRestriction === 'card'
                            ? t('residenceStep.partial.cardDescription')
                            : t('residenceStep.partial.bankingDescription')}
                    </p>
                </div>
                <div className="flex w-full flex-col gap-2">
                    <Button shadowSize="4" onClick={() => void handleNext()} loading={isLoading} disabled={isLoading}>
                        {t('residenceStep.partial.continue')}
                    </Button>
                    <button
                        type="button"
                        className="mt-1 text-center text-body-s underline underline-offset-2"
                        onClick={() => setView('select')}
                    >
                        {t('residenceStep.restricted.changeCountry')}
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'restricted' || view === 'notify' || view === 'notify-done') {
        return (
            <div className="flex h-full w-full flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-heading-xs font-extrabold">{t('residenceStep.restricted.title')}</h2>
                    <p className="text-body-s text-foreground-secondary">{t('residenceStep.restricted.description')}</p>
                    {view === 'notify' && (
                        <div className="mt-2 flex flex-col gap-2">
                            <BaseInput
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder={t('residenceStep.restricted.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            {emailError && <p className="text-body-s text-error">{emailError}</p>}
                        </div>
                    )}
                    {view === 'notify-done' && (
                        <p className="text-body-s font-bold">{t('residenceStep.restricted.notifyDone')}</p>
                    )}
                </div>
                <div className="flex w-full flex-col gap-2">
                    {view === 'notify' ? (
                        <Button shadowSize="4" onClick={onNotifySubmit}>
                            {t('residenceStep.restricted.notifySubmit')}
                        </Button>
                    ) : (
                        <Button shadowSize="4" onClick={onRestrictedContinue} loading={isLoading} disabled={isLoading}>
                            {t('residenceStep.restricted.continueAnyway')}
                        </Button>
                    )}
                    {view === 'restricted' && (
                        <Button variant="stroke" onClick={() => setView('notify')}>
                            {t('residenceStep.restricted.notifyMe')}
                        </Button>
                    )}
                    <button
                        type="button"
                        className="mt-1 text-center text-body-s underline underline-offset-2"
                        onClick={() => setView('select')}
                    >
                        {t('residenceStep.restricted.changeCountry')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col justify-between gap-4">
            <div className="flex w-full flex-col gap-2">
                {/* Rendered here, not by the step chrome, so the heads-up
                    sub-views don't repeat it (descriptionInView on the step). */}
                <p className="mb-1 text-body-s text-foreground-secondary">{t('steps.residence.description')}</p>
                <BaseSelect
                    options={countryOptions}
                    placeholder={t('residenceStep.countryPlaceholder')}
                    value={residenceCountry || undefined}
                    onValueChange={onResidenceChange}
                />
                <button
                    type="button"
                    className="self-start text-left text-body-s underline underline-offset-2"
                    aria-expanded={showSecondCountry}
                    onClick={() => {
                        // Collapsing must also clear the stored pick — an
                        // invisible second residence would still be sent to
                        // analytics and persisted after signup. Dispatch stays
                        // outside the updater (React may replay updaters).
                        if (showSecondCountry && secondResidenceCountry) {
                            dispatch(setupActions.setSecondResidenceCountry(''))
                        }
                        setShowSecondCountry((current) => !current)
                    }}
                >
                    {t('residenceStep.multiDocLink')}
                </button>
                {showSecondCountry && (
                    <BaseSelect
                        options={countryOptions}
                        placeholder={t('residenceStep.secondCountryPlaceholder')}
                        value={secondResidenceCountry || undefined}
                        onValueChange={(value) => dispatch(setupActions.setSecondResidenceCountry(value))}
                    />
                )}
                {/* Dual-residence comparison: facts about each residence, not a
                    menu of perks. The guidance leads with the truth norm; the
                    order is presentation only and eligibility stays with the
                    verification, so there is nothing to win by answering
                    untruthfully. Entirely client-derived (restriction tiers +
                    the same static rail map Unlock payments renders). */}
                {showSecondCountry &&
                    residenceCountry &&
                    secondResidenceCountry &&
                    residenceCountry !== secondResidenceCountry && (
                        <div className="mt-2 flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2">
                                {[residenceCountry, secondResidenceCountry].map((iso2) => {
                                    const summary = residenceAvailability(restrictionSets, iso2)
                                    const label = countryOptions.find((option) => option.value === iso2)?.label ?? iso2
                                    return (
                                        <div
                                            key={iso2}
                                            className="rounded-sm border border-border-default bg-background-default p-3"
                                        >
                                            <p className="mb-1 text-body-xs font-bold">
                                                {t('residenceStep.compare.cardTitle', { country: label })}
                                            </p>
                                            <ul className="space-y-0.5 text-body-xs text-foreground-secondary">
                                                {summary.available.map((item) => (
                                                    <li key={item}>{t(`residenceStep.compare.items.${item}`)}</li>
                                                ))}
                                                {summary.unavailable.map((item) => (
                                                    <li key={item} className="text-foreground-secondary line-through">
                                                        {t(`residenceStep.compare.missing.${item}`)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="rounded-sm border border-border-default bg-background-default p-3 text-body-xs text-foreground-secondary">
                                <p className="mb-1 font-bold text-foreground-primary">
                                    {t('residenceStep.compare.guideTitle')}
                                </p>
                                <p>{t('residenceStep.compare.guideDeclaration')}</p>
                                <p className="mt-1">{t('residenceStep.compare.guideOrder')}</p>
                                <p className="mt-1">{t('residenceStep.compare.guideSecond')}</p>
                            </div>
                        </div>
                    )}
            </div>
            <Button shadowSize="4" onClick={onContinue} disabled={!residenceCountry || isLoading} loading={isLoading}>
                {t('next')}
            </Button>
        </div>
    )
}

export default ResidenceStep
