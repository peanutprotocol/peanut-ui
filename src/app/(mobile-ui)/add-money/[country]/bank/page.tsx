'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatAmount } from '@/utils/general.utils'
import { countryData } from '@/components/AddMoney/consts'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { getKycModalVariant, getGateUserMessage } from '@/utils/capability-gate'
import { useModalsContext } from '@/context/ModalsContext'
import { useCreateOnramp, GENERIC_ONRAMP_ERROR } from '@/hooks/useCreateOnramp'
import { useParams, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import countryCurrencyMappings, { isNonEuroSepaCountry, isUKCountry } from '@/constants/countryCurrencyMapping'
import { formatUnits } from 'viem'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { getCurrencyConfig, getCurrencySymbol, getMinimumAmount, railJurisdictionForBank } from '@/utils/bridge.utils'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import InfoCard from '@/components/Global/InfoCard'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useTosGuard } from '@/hooks/useTosGuard'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycReverificationPendingModal } from '@/components/Kyc/KycReverificationPendingModal'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import AdvisoryPreemptModal from '@/components/Kyc/AdvisoryPreemptModal'
import { useAdvisoryPreempt } from '@/hooks/useAdvisoryPreempt'
import { useEeaUpliftFunnel } from '@/hooks/useEeaUpliftFunnel'
import { upliftTriggerFromGate, upliftTriggerFromAdvisory } from '@/utils/eea-uplift.utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyCountryUrl } from '@/utils/native-routes'
import { useSafeBack } from '@/hooks/useSafeBack'
import { getRegionIntent } from '@/utils/regions.utils'
import { useTranslations } from 'next-intl'

// Step type for URL state
type BridgeBankStep = 'inputAmount' | 'showDetails'

export default function OnrampBankPage() {
    const params = useParams()
    const _searchParams = useSearchParams()
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')

    // URL state - persisted in query params
    // Example: /add-money/mexico/bank?step=inputAmount&amount=500
    // history stays at the nuqs default ('replace'): `amount` is rewritten on every
    // keystroke, so 'push' would stack a browser-history entry per character and the
    // NavHeader back button (useSafeBack → router.back()) would only step through stale
    // amounts of this same screen instead of leaving it. The URL stays shareable either
    // way. Enforced by the no-restricted-syntax guard in eslint.config.js.
    const [urlState, setUrlState] = useQueryStates({
        step: parseAsStringEnum<BridgeBankStep>(['inputAmount', 'showDetails']),
        amount: parseAsString,
    })

    // Amount from URL
    const rawTokenAmount = urlState.amount ?? ''

    // Local UI state (not URL-appropriate - transient)
    const [showWarningModal, setShowWarningModal] = useState<boolean>(false)
    const [showKycModal, setShowKycModal] = useState<boolean>(false)
    const { setError, error, setOnrampData, onrampData } = useOnrampFlow()

    const { balance } = useWallet()
    const { user, fetchUser } = useAuth()
    const { createOnramp, isLoading: isCreatingOnramp } = useCreateOnramp()

    // inline sumsub kyc flow for bridge bank onramp
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time, derived from the destination country
    // (e.g. /add-money/usa → NA → bridge-requirements).
    // EEA-uplift funnel events (PostHog): started on launch, completed on KYC
    // success. trackCompleted no-ops unless an uplift was started this session.
    const {
        trackStarted: trackUpliftStarted,
        trackCompleted: trackUpliftCompleted,
        reset: resetUpliftFunnel,
    } = useEeaUpliftFunnel('deposit')

    const sumsubFlow = useMultiPhaseKycFlow({
        // Fire completed at Sumsub approval (verification submitted), not at
        // end-of-flow — so it isn't lost if the user drops during the
        // post-approval ToS / preparing steps.
        onKycApproved: () => trackUpliftCompleted(),
        onKycSuccess: () => {
            setUrlState({ step: 'inputAmount' })
        },
        // Abandoned attempt: clear the pending start so a later unrelated KYC
        // success on this page can't mis-fire eea_uplift_completed.
        onManualClose: resetUpliftFunnel,
    })

    // read country from path params (web) or query params (native/capacitor)
    const selectedCountryPath = (params.country as string) || _searchParams.get('country') || ''

    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

    const onBack = useSafeBack(selectedCountryPath ? addMoneyCountryUrl(selectedCountryPath) : '/add-money')

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) =>
            selectedCountryPath.toLowerCase() === currency.country.toLowerCase() ||
            currency.path?.toLowerCase() === selectedCountryPath.toLowerCase()
    )?.currencyCode

    // non-eur sepa countries that are currently experiencing issues
    const isNonEuroSepa = isNonEuroSepaCountry(nonEuroCurrency)

    // uk-specific check
    const isUK = isUKCountry(selectedCountryPath)

    // Country-scoped bank-channel readiness gate. The scope narrows to the
    // rail jurisdiction this page actually deposits into (PT/DE/FR/… → EU
    // SEPA; US → US ACH; MX → SPEI; etc.), so a stuck PENDING rail in an
    // unrelated jurisdiction (e.g. a ghost BANK_TRANSFER_AR row) can't keep
    // this page in a "Setting up your account…" wait loop. Unknown country
    // → undefined → falls back to channel-only filter.
    const { gateFor } = useCapabilities()
    const bankCountry = useMemo(() => railJurisdictionForBank(selectedCountry?.id), [selectedCountry?.id])
    const gate = useMemo(() => gateFor('deposit', { channel: 'bank', country: bankCountry }), [gateFor, bankCountry])
    // bridge re-verification ("we're reviewing your details") modal for the
    // waiting-on-provider gate — keeps the status poll alive + auto-dismisses.
    const pendingModal = useWaitingOnProviderModal(gate)
    // A ready bank rail can still carry a pending Bridge requirement (the gate's
    // `advisory`). Enforce it as a mandatory, non-skippable pre-empt at the
    // proceed step — the deposit cannot continue until it's completed.
    const advisory = gate.kind === 'ready' ? gate.advisory : undefined
    const { intercept: advisoryIntercept, modalProps: advisoryModalProps } = useAdvisoryPreempt({
        advisory,
        isLoading: sumsubFlow.isLoading,
        // Route through the self-heal resubmit path (reheal-tagged action) so the
        // completed submission round-trips to Bridge. start-action mints a plain
        // token whose webhook completion has no Bridge relay → answers are dropped.
        // note: eea_uplift_started is fired at modal-open (handleAmountContinue),
        // not here, so abandoners are captured too.
        onCompleteNow: () => {
            if (!advisory) return Promise.resolve()
            return sumsubFlow.handleSelfHealResubmit('BRIDGE', advisory.requirementKey)
        },
    })
    const { guardWithTos, showBridgeTos, hideTos } = useTosGuard()
    const { setIsSupportModalOpen } = useModalsContext()

    // close kyc modal when sumsub sdk opens
    useEffect(() => {
        if (sumsubFlow.showWrapper) setShowKycModal(false)
    }, [sumsubFlow.showWrapper])

    useEffect(() => {
        fetchUser()
    }, [])

    const peanutWalletBalance = useMemo(() => {
        return balance !== undefined ? formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : ''
    }, [balance])

    const minimumAmount = useMemo(() => {
        if (!selectedCountry?.id) return 1
        return getMinimumAmount(selectedCountry.id)
    }, [selectedCountry?.id])

    // get local currency for the selected country (EUR, MXN, USD)
    const localCurrency = useMemo(() => {
        if (!selectedCountry?.id) return 'USD'
        return getCurrencyConfig(selectedCountry.id, 'onramp').currency.toUpperCase()
    }, [selectedCountry?.id])

    // get exchange rate: local currency → USD (for limits validation)
    // skip for USD since it's 1:1
    const { exchangeRate, isLoading: isRateLoading } = useExchangeRate({
        sourceCurrency: localCurrency,
        destinationCurrency: 'USD',
        enabled: localCurrency !== 'USD',
    })

    // convert input amount to USD for limits validation
    // bridge limits are always in USD, but user inputs in local currency
    const usdEquivalent = useMemo(() => {
        if (!rawTokenAmount) return 0
        const numericAmount = parseFloat(rawTokenAmount.replace(/,/g, ''))
        if (isNaN(numericAmount)) return 0

        // for USD, no conversion needed
        if (localCurrency === 'USD') return numericAmount

        // convert local currency to USD
        return exchangeRate > 0 ? numericAmount * exchangeRate : 0
    }, [rawTokenAmount, localCurrency, exchangeRate])

    // validate against user's bridge limits
    // uses USD equivalent to correctly compare against USD-denominated limits
    const limitsValidation = useLimitsValidation({
        flowType: 'onramp',
        amount: usdEquivalent,
        currency: 'USD',
    })

    // Default to inputAmount step when no step in URL
    useEffect(() => {
        if (urlState.step) return
        if (user === null) return
        setUrlState({ step: 'inputAmount' })
    }, [user, urlState.step, setUrlState])

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }
            const amount = Number(amountStr)
            if (!Number.isFinite(amount)) {
                setError({ showError: true, errorMessage: t('errors.invalidNumber') })
                return false
            }
            if (amount && amount < minimumAmount) {
                setError({ showError: true, errorMessage: t('errors.minimumDeposit', { amount: minimumAmount }) })
                return false
            }
            setError({ showError: false, errorMessage: '' })
            return true
        },
        [setError, minimumAmount, t]
    )

    // Handle amount change - sync to URL state
    const handleTokenAmountChange = useCallback(
        (value: string | undefined) => {
            const newAmount = value || null // null removes from URL
            setUrlState({ amount: newAmount })
        },
        [setUrlState]
    )

    // Validate amount when it changes
    useEffect(() => {
        if (rawTokenAmount === '') {
            setError({ showError: false, errorMessage: '' })
        } else {
            validateAmount(rawTokenAmount)
        }
    }, [rawTokenAmount, validateAmount, setError])

    const handleAmountContinue = () => {
        if (!validateAmount(rawTokenAmount)) return

        if (gate.kind !== 'ready') {
            // capabilities still loading — silently no-op instead of flashing
            // a misleading needs_kyc modal.
            if (gate.kind === 'loading') return
            // `waiting-on-provider` means bridge is re-reviewing submitted info
            // (e.g. right after an eea uplift) — the user has nothing to do but
            // wait. Show the pending modal instead of a dead button, and re-arm
            // the capability poller so we pick up bridge's latest status live and
            // the modal auto-dismisses the moment the gate clears.
            if (gate.kind === 'waiting-on-provider') {
                pendingModal.open()
                return
            }
            if (gate.kind === 'accept-tos') {
                guardWithTos()
            } else {
                // urgent (post-cliff) eea uplift lands here as a fixable-rejection —
                // fire the funnel event as this KYC modal opens.
                const upliftTrigger = upliftTriggerFromGate(gate)
                if (upliftTrigger) trackUpliftStarted(upliftTrigger)
                setShowKycModal(true)
            }
            return
        }

        // ready — enforce the mandatory verification pre-empt. The proceed body
        // (record the amount-entered event, open the confirmation modal) only
        // runs once there's no pending requirement; while one exists the modal
        // blocks and this never fires, so the event can't double-count.
        // upcoming (future-dated) eea uplift opens the advisory modal here — fire
        // the funnel event as it opens.
        const advisoryTrigger = upliftTriggerFromAdvisory(advisory)
        if (advisoryTrigger) trackUpliftStarted(advisoryTrigger)
        advisoryIntercept(() => {
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_AMOUNT_ENTERED, {
                amount_usd: usdEquivalent,
                method_type: 'bank',
                country: selectedCountryPath,
            })
            setShowWarningModal(true)
        })
    }

    const handleWarningConfirm = async () => {
        if (!selectedCountry) {
            setError({
                showError: true,
                errorMessage: t('errors.selectCountryFirst'),
            })
            return
        }

        setShowWarningModal(false)
        try {
            const onrampDataResponse = await createOnramp({
                amount: rawTokenAmount,
                country: selectedCountry,
            })
            setOnrampData(onrampDataResponse)

            if (onrampDataResponse.transferId) {
                posthog.capture(ANALYTICS_EVENTS.DEPOSIT_CONFIRMED, {
                    amount_usd: usdEquivalent,
                    method_type: 'bank',
                    country: selectedCountryPath,
                })
                setUrlState({ step: 'showDetails' })
            } else {
                setError({
                    showError: true,
                    errorMessage: t('errors.onrampDetails'),
                })
            }
        } catch (error) {
            setShowWarningModal(false)
            const isError = error instanceof Error
            const errorMessage = isError ? error.message : GENERIC_ONRAMP_ERROR
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                method_type: 'bank',
                // keep the distinct label for truly-unexpected non-Error throws
                error_message: isError ? errorMessage : 'Unknown error',
            })
            // show the caught message directly — createOnramp carries the specific
            // reason on the thrown Error, so we don't read any hook state here.
            setError({
                showError: true,
                errorMessage,
            })
        }
    }

    const handleWarningCancel = () => {
        setShowWarningModal(false)
    }

    // Redirect to inputAmount if showDetails is accessed without required data (deep link / back navigation)
    useEffect(() => {
        if (urlState.step === 'showDetails' && !onrampData?.transferId) {
            setUrlState({ step: 'inputAmount' })
        }
    }, [urlState.step, onrampData?.transferId, setUrlState])

    // Show loading while user is being fetched and no step in URL yet
    if (!urlState.step && user === null) {
        return <PeanutLoading />
    }

    if (!selectedCountry) {
        return (
            <div className="space-y-8 self-start">
                <NavHeader title={tCommon('notFound')} onPrev={onBack} />
                <EmptyState
                    title={tCommon('countryNotFound')}
                    description={tCommon('tryDifferentCountry')}
                    icon="search"
                />
            </div>
        )
    }

    // Still determining initial step
    if (!urlState.step) {
        return <PeanutLoading />
    }

    if (urlState.step === 'showDetails') {
        // Show loading while useEffect redirects if data is missing
        if (!onrampData?.transferId) {
            return <PeanutLoading />
        }
        return <AddMoneyBankDetails onBack={() => setUrlState({ step: 'inputAmount' })} />
    }

    if (urlState.step === 'inputAmount') {
        const showLimitsCard = limitsValidation.isBlocking || limitsValidation.isWarning

        return (
            <div className="flex flex-col justify-start space-y-8">
                <NavHeader title={t('title')} onPrev={onBack} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">{t('howMuchToAdd')}</div>
                    <AmountInput
                        initialAmount={rawTokenAmount}
                        setPrimaryAmount={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                        primaryDenomination={
                            selectedCountry
                                ? {
                                      symbol: getCurrencySymbol(
                                          getCurrencyConfig(selectedCountry.id, 'onramp').currency
                                      ),
                                      price: 1,
                                      decimals: 2,
                                  }
                                : undefined
                        }
                        hideBalance
                    />

                    {/* limits warning/error card */}
                    {showLimitsCard &&
                        (() => {
                            const limitsCardProps = getLimitsWarningCardProps({
                                validation: limitsValidation,
                                flowType: 'onramp',
                                currency: 'USD',
                            })
                            return limitsCardProps ? <LimitsWarningCard {...limitsCardProps} /> : null
                        })()}

                    {!limitsValidation.isBlocking && (
                        <InfoCard variant="warning" icon="alert" description={t('amountMustMatchBank')} />
                    )}

                    {/* Warning for non-EUR SEPA countries (not UK — UK uses Faster Payments with GBP) */}
                    {!limitsValidation.isBlocking && isNonEuroSepa && !isUK && (
                        <InfoCard
                            variant="info"
                            icon="info"
                            title={t('eurAccountsOnlyTitle')}
                            description={t('eurAccountsOnlyDescription')}
                        />
                    )}
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={
                            !parseFloat(rawTokenAmount) ||
                            parseFloat(rawTokenAmount) < minimumAmount ||
                            error.showError ||
                            isCreatingOnramp ||
                            limitsValidation.isBlocking ||
                            (localCurrency !== 'USD' && isRateLoading)
                        }
                        className="w-full"
                        loading={isCreatingOnramp}
                    >
                        {tCommon('continue')}
                    </Button>
                    {/* only show error if limits blocking card is not displayed (warnings can coexist) */}
                    {error.showError && !!error.errorMessage && !limitsValidation.isBlocking && (
                        <ErrorAlert description={error.errorMessage} />
                    )}
                </div>

                <OnrampConfirmationModal
                    visible={showWarningModal}
                    onClose={handleWarningCancel}
                    onConfirm={handleWarningConfirm}
                    amount={rawTokenAmount}
                    currency={getCurrencySymbol(getCurrencyConfig(selectedCountry.id, 'onramp').currency)}
                />

                <InitiateKycModal
                    visible={showKycModal}
                    onClose={() => {
                        // dismiss = abandon: clear the uplift latch so a later
                        // unrelated KYC success can't mis-fire eea_uplift_completed.
                        setShowKycModal(false)
                        resetUpliftFunnel()
                    }}
                    onVerify={async () => {
                        if (gate.kind === 'restart-identity') {
                            await sumsubFlow.handleRestartIdentity()
                        } else if (gate.kind === 'fixable-rejection') {
                            await sumsubFlow.handleSelfHealResubmit('BRIDGE')
                        } else {
                            await sumsubFlow.handleInitiateKyc(
                                getRegionIntent(selectedCountry?.region ?? 'rest-of-the-world'),
                                undefined,
                                gate.kind === 'needs-enrollment' || undefined,
                                selectedCountry?.id
                            )
                        }
                    }}
                    onContactSupport={() => {
                        setShowKycModal(false)
                        resetUpliftFunnel()
                        setIsSupportModalOpen(true)
                    }}
                    isLoading={sumsubFlow.isLoading}
                    error={sumsubFlow.error}
                    variant={getKycModalVariant(gate.kind)}
                    providerMessage={getGateUserMessage(gate)}
                    regionName={selectedCountry?.title}
                />

                <AdvisoryPreemptModal {...advisoryModalProps} />

                <KycReverificationPendingModal
                    isOpen={pendingModal.isOpen}
                    onClose={pendingModal.close}
                    message={pendingModal.message}
                />

                <SumsubKycModals flow={sumsubFlow} />

                <BridgeTosStep
                    visible={showBridgeTos}
                    onComplete={() => {
                        hideTos()
                        handleWarningConfirm()
                    }}
                    onSkip={hideTos}
                    reasonCode={gate.kind === 'accept-tos' ? gate.reason?.code : undefined}
                />
            </div>
        )
    }

    return null
}
