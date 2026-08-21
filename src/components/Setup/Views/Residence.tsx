import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { countryData } from '@/components/AddMoney/consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { RESTRICTED_RESIDENCE_ISO2 } from '@/constants/residence.consts'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { isValidEmail } from '@/utils/format.utils'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type ResidenceView = 'select' | 'restricted' | 'notify' | 'notify-done'

const ResidenceStep = () => {
    const t = useTranslations('setup')
    const dispatch = useAppDispatch()
    const { residenceCountry, secondResidenceCountry } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { countryCode: geoCountryCode } = useGeoLocation()

    const [view, setView] = useState<ResidenceView>('select')
    const [showSecondCountry, setShowSecondCountry] = useState(!!secondResidenceCountry)
    const [email, setEmail] = useState('')
    const [emailError, setEmailError] = useState('')
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)

    const countryOptions = useMemo(
        () =>
            countryData
                .filter((c) => c.type === 'country' && !!c.iso2)
                .map((c) => ({ label: c.title, value: c.iso2!.toUpperCase() }))
                .sort((a, b) => a.label.localeCompare(b.label)),
        []
    )

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
        if (RESTRICTED_RESIDENCE_ISO2.has(residenceCountry)) {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN, {
                residence_country: residenceCountry,
            })
            setView('restricted')
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

    if (view === 'restricted' || view === 'notify' || view === 'notify-done') {
        return (
            <div className="flex h-full w-full flex-col justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-extrabold">{t('residenceStep.restricted.title')}</h2>
                    <p className="text-sm text-grey-1">{t('residenceStep.restricted.description')}</p>
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
                            {emailError && <p className="text-sm text-error">{emailError}</p>}
                        </div>
                    )}
                    {view === 'notify-done' && (
                        <p className="text-sm font-bold">{t('residenceStep.restricted.notifyDone')}</p>
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
                        className="mt-1 text-center text-sm underline underline-offset-2"
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
                <BaseSelect
                    options={countryOptions}
                    placeholder={t('residenceStep.countryPlaceholder')}
                    value={residenceCountry || undefined}
                    onValueChange={onResidenceChange}
                />
                <button
                    type="button"
                    className="self-start text-left text-sm underline underline-offset-2"
                    aria-expanded={showSecondCountry}
                    onClick={() => setShowSecondCountry((current) => !current)}
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
            </div>
            <Button shadowSize="4" onClick={onContinue} disabled={!residenceCountry || isLoading} loading={isLoading}>
                {t('next')}
            </Button>
        </div>
    )
}

export default ResidenceStep
