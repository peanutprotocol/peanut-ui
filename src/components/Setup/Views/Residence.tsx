import BaseInput from '@/components/0_Bruddle/BaseInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Button } from '@/components/0_Bruddle/Button'
import { CountryCombobox } from '@/components/Common/CountryCombobox'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { useResidenceRestrictionSetsWithStatus } from '@/hooks/useResidenceRestrictionSets'
import { useGeoLocation } from '@/hooks/useGeoLocation'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { isValidEmail } from '@/utils/format.utils'
import { residenceAvailability } from '@/utils/residence-availability'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import posthog from 'posthog-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type ResidenceView = 'select' | 'restricted' | 'notify' | 'notify-done' | 'partial' | 'congrats'
type PartialRestriction = 'card' | 'banking'

// An underlined text link is ~20px tall; the `after:` pseudo-element grows the
// tap target to the 44px minimum without moving the text (design.md touch law).
const UNDERLINED_LINK =
    'relative text-body-s underline underline-offset-2 after:absolute after:inset-x-0 after:-inset-y-3.5 focus-visible:outline-[3px] focus-visible:outline-action-focus'
const CHANGE_COUNTRY_LINK = `mt-1 self-center text-center disabled:opacity-50 ${UNDERLINED_LINK}`

const ResidenceStep = () => {
    const t = useTranslations('setup')
    const locale = useLocale()
    const dispatch = useAppDispatch()
    const { residenceCountry, secondResidenceCountry } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { countryCode: geoCountryCode } = useGeoLocation()
    // server-authoritative tier lists with the bundled mirror as fallback
    const { sets: restrictionSets, settled: restrictionSetsSettled } = useResidenceRestrictionSetsWithStatus()

    const [view, setView] = useState<ResidenceView>('select')
    useBackHandler(() => {
        if (!isLoading) setView('select')
        return true
    }, view !== 'select')
    const [partialRestriction, setPartialRestriction] = useState<PartialRestriction>('card')
    const [showSecondCountry, setShowSecondCountry] = useState(!!secondResidenceCountry)
    const [email, setEmail] = useState('')
    const [emailError, setEmailError] = useState('')
    // whether the current selection came from the geo suggestion, untouched
    const wasPrefilledRef = useRef(false)

    const countryOptions = useMemo(() => buildResidenceCountryOptions(locale), [locale])

    // The geo guess, only if it is actually offered in the list.
    const geoSuggestion = useMemo(() => {
        if (!geoCountryCode) return undefined
        const suggested = geoCountryCode.toUpperCase()
        return countryOptions.some((option) => option.value === suggested) ? suggested : undefined
    }, [geoCountryCode, countryOptions])

    // Geo is a suggestion only: preselect the dropdown when nothing is chosen
    // yet, never auto-advance, and never trigger the restricted screen from it.
    useEffect(() => {
        if (residenceCountry || !geoSuggestion) return
        wasPrefilledRef.current = true
        dispatch(setupActions.setResidenceCountry(geoSuggestion))
    }, [geoSuggestion, residenceCountry, dispatch])

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
        // The congrats claim is definitive, so it only renders from settled
        // data: until the server lookup resolves (either way), advance
        // silently rather than asserting "nothing is restricted" off the
        // bundled mirror. Heads-ups still render from the mirror — they only
        // ever over-warn.
        if (!restrictionSetsSettled) {
            void handleNext()
            return
        }
        // "Nothing is restricted where you live" must hold for the whole
        // declared residence set: a restricted second country just showed its
        // limits on the compare cards, so the congrats claim would contradict
        // them. Advance silently instead — the heads-ups stay primary-driven.
        if (
            secondResidenceCountry &&
            (restrictionSets.full.has(secondResidenceCountry) ||
                restrictionSets.cardOnly.has(secondResidenceCountry) ||
                restrictionSets.bankingOnly.has(secondResidenceCountry))
        ) {
            void handleNext()
            return
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN, {
            residence_country: residenceCountry,
        })
        setView('congrats')
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

    /* The tier sets render from the bundled mirror and are replaced by the
       server-authoritative lists asynchronously. A congrats view reached
       before that response must not outlive it: re-evaluate on every set
       change and demote to the matching heads-up (or back to the selector
       when the second residence turned out restricted). Heads-up views are
       never demoted — over-warning is stale-safe. */
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
            setPartialRestriction(partial)
            setView('partial')
            return
        }
        const second = deriveResidenceRestrictionsFrom(restrictionSets, secondResidenceCountry)
        if (second.banking || second.card) setView('select')
    }, [restrictionSets, view, residenceCountry, secondResidenceCountry])

    if (view === 'congrats') {
        /* One paragraph, gates kept honest: dollars and @username sends need
           no ID check; the bank rail unlocks with verification. The card is
           deliberately NOT mentioned: its closed beta must stay unnamed in
           onboarding (product direction), and any card mention must state
           every access gate (compliance) — no sentence satisfies both, and
           the compare cards already state card availability per residence.
           The rail phrase
           comes from the same per-country map the compare cards render and is
           named ONLY where a fiat rail exists (PIX, AR, SPEI, ACH, SEPA); for
           the rest of the world the map falls back to 'bank', which here means
           blockchain-only — so the ID-check clause is dropped entirely rather
           than promising a rail verification cannot deliver. */
        const railItem = residenceAvailability(restrictionSets, residenceCountry).available.find(
            (item) => item !== 'p2p' && item !== 'card' && item !== 'bank'
        )
        return (
            <div className="flex h-full w-full flex-col justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="w-full text-left text-heading-xs leading-tight">
                        {t('residenceStep.congrats.title')}
                    </h1>
                    <p className="text-body-m text-foreground-secondary">
                        {railItem
                            ? t('residenceStep.congrats.description', {
                                  rail: t(`residenceStep.congrats.rails.${railItem}`),
                              })
                            : t('residenceStep.congrats.descriptionNoRail')}
                    </p>
                </div>
                <div className="flex w-full flex-col gap-4">
                    <Button shadowSize="4" onClick={() => void handleNext()} loading={isLoading} disabled={isLoading}>
                        {t('residenceStep.congrats.continue')}
                    </Button>
                    <button
                        type="button"
                        className={CHANGE_COUNTRY_LINK}
                        onClick={() => setView('select')}
                        disabled={isLoading}
                    >
                        {t('residenceStep.restricted.changeCountry')}
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'partial') {
        return (
            <div className="flex h-full w-full flex-col justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="w-full text-left text-heading-xs leading-tight">
                        {t('residenceStep.partial.title')}
                    </h1>
                    <p className="text-body-m text-foreground-secondary">
                        {partialRestriction === 'card'
                            ? t('residenceStep.partial.cardDescription')
                            : t('residenceStep.partial.bankingDescription')}
                    </p>
                </div>
                <div className="flex w-full flex-col gap-4">
                    <Button shadowSize="4" onClick={() => void handleNext()} loading={isLoading} disabled={isLoading}>
                        {t('residenceStep.partial.continue')}
                    </Button>
                    <button
                        type="button"
                        className={CHANGE_COUNTRY_LINK}
                        onClick={() => setView('select')}
                        disabled={isLoading}
                    >
                        {t('residenceStep.restricted.changeCountry')}
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'restricted' || view === 'notify' || view === 'notify-done') {
        return (
            <div className="flex h-full w-full flex-col justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <h1 className="w-full text-left text-heading-xs leading-tight">
                        {t('residenceStep.restricted.title')}
                    </h1>
                    <p className="text-body-m text-foreground-secondary">{t('residenceStep.restricted.description')}</p>
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
                            {emailError && <FieldError>{emailError}</FieldError>}
                        </div>
                    )}
                    {view === 'notify-done' && (
                        <p className="text-label-l">{t('residenceStep.restricted.notifyDone')}</p>
                    )}
                </div>
                <div className="flex w-full flex-col gap-4">
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
                        className={CHANGE_COUNTRY_LINK}
                        onClick={() => setView('select')}
                        disabled={isLoading}
                    >
                        {t('residenceStep.restricted.changeCountry')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col justify-between gap-6">
            <div className="flex w-full flex-col gap-2">
                {/* Rendered here, not by the step chrome, so the heads-up
                    sub-views can replace them with their own single heading
                    (titleInView/descriptionInView on the step). */}
                <h1 className="w-full text-left text-heading-xs leading-tight">{t('steps.residence.title')}</h1>
                <p className="mb-1 text-body-s text-foreground-secondary">{t('steps.residence.description')}</p>
                <CountryCombobox
                    options={countryOptions}
                    placeholder={t('residenceStep.countryPlaceholder')}
                    // Falls back to the suggestion for the one frame between
                    // mount and the effect below committing it, so the field
                    // opens already filled instead of visibly changing itself.
                    value={residenceCountry || geoSuggestion}
                    onValueChange={onResidenceChange}
                />
                <button
                    type="button"
                    className={`self-start text-left ${UNDERLINED_LINK}`}
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
                    <CountryCombobox
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
                                            <p className="mb-1 text-label-m">
                                                {t('residenceStep.compare.cardTitle', { country: label })}
                                            </p>
                                            <ul className="space-y-2 text-body-xs text-foreground-secondary">
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
