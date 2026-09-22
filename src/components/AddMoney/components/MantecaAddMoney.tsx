'use client'
// TODO(deposit-accounts, TASK-22756): fold Manteca AR/BR into the in-place
// deposit-accounts hub flow (?corridor=&step=) so Bridge corridors and Manteca
// share ONE residence gate and one back model. This interim patch adds the
// residence gate and return-to-hub only. Deliberate, tracked.
import { type FC, useEffect, useMemo, useState, useCallback } from 'react'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import MantecaPixQrDeposit from '@/components/AddMoney/components/MantecaPixQrDeposit'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import InputAmountStep from '@/components/AddMoney/components/InputAmountStep'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { countryData } from '@/components/AddMoney/consts'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { isVerifiedForCountry } from '@/utils/regions.utils'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { MIN_MANTECA_DEPOSIT_AMOUNT } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { useResidenceIso2s } from '@/features/deposit-accounts/useResidenceIso2s'
import { residenceAllows } from '@/features/deposit-accounts/residenceGate'
import { ResidenceRequiredScreen } from '@/features/deposit-accounts/components/ResidenceRequiredScreen'
import { withReturnTo, readReturnTo } from '@/utils/return-to.utils'

// Step type for URL state
type MantecaStep = 'inputAmount' | 'depositDetails' | 'showQR'

// Currency denomination type for URL state
type CurrencyDenomination = 'USD' | 'ARS' | 'BRL' | 'MXN' | 'EUR'

const MantecaAddMoney: FC = () => {
    const params = useParams()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const locale = useLocale()
    const t = useTranslations('addMoney')
    const router = useRouter()

    // URL state - persisted in query params
    // Example: /add-money/argentina/manteca?step=inputAmount&amount=100&currency=ARS
    // The `amount` is stored in whatever denomination `currency` specifies.
    // history stays at the nuqs default ('replace'): `amount` is rewritten on every
    // keystroke, so 'push' would stack a browser-history entry per character and the
    // NavHeader back button (useSafeBack → router.back()) would only step through stale
    // amounts of this same screen instead of leaving it. The URL stays shareable either
    // way. Enforced by the no-restricted-syntax guard in eslint.config.js.
    const [urlState, setUrlState] = useQueryStates({
        step: parseAsStringEnum<MantecaStep>(['inputAmount', 'depositDetails', 'showQR']),
        amount: parseAsString,
        currency: parseAsStringEnum<CurrencyDenomination>(['USD', 'ARS', 'BRL', 'MXN', 'EUR']),
    })

    // Derive state from URL (with defaults)
    const step: MantecaStep = urlState.step ?? 'inputAmount'
    // Amount from URL - this is in the denomination specified by `currency`
    const displayedAmount = urlState.amount ?? ''

    // Local UI state for tracking both amounts (needed for API call and validation)
    const [usdAmount, setUsdAmount] = useState<string>('')
    const [localCurrencyAmount, setLocalCurrencyAmount] = useState<string>('')

    // Other local UI state (not URL-appropriate - transient or API responses)
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    // flow-level failures (API/provider) — rendered in the Callout
    const [error, setError] = useState<string | null>(null)
    // client-side minimum-amount validation — rendered as the field's own error
    const [validationError, setValidationError] = useState<string | null>(null)
    const [depositDetails, setDepositDetails] = useState<MantecaDepositResponseData>()

    // path params (web) or query params (native static export)
    const selectedCountryPath = (params.country as string) || searchParams.get('country') || ''
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])
    // Default the input denomination to the local currency (like withdraw) — the user
    // pays the bank/QR in ARS/BRL, and a USD-first input causes wrong-amount deposits.
    // USD stays one toggle away and sticks via the URL param.
    const currentDenomination: CurrencyDenomination =
        urlState.currency ?? (selectedCountry?.currency as CurrencyDenomination) ?? 'USD'
    // Back leaves to the origin the caller stated (the hub sets `returnTo`), and
    // otherwise to the hub itself — not the bare `/add-money/argentina` amount
    // route the user never knowingly opened.
    const onBack = useSafeBack(readReturnTo(searchParams) ?? '/add-money?method=bank')
    const residenceIso2s = useResidenceIso2s()
    // Argentina's Manteca top-up mints a CVU per deposit, and Manteca rejects a
    // non-resident only after amount + KYC. Brazil's asks for a CPF the same
    // way. Gate on residence first, from the corridor's own rule.
    const residenceGatedCountry =
        selectedCountry?.id === 'AR' || selectedCountry?.id === 'BR' ? (selectedCountry.id as 'AR' | 'BR') : null
    const requiresResidenceGate =
        residenceGatedCountry !== null &&
        !residenceAllows(residenceGatedCountry === 'AR' ? 'BANK_TRANSFER_AR' : 'PIX_BR', residenceIso2s)
    // The pool→full upgrade gate asks "did the user clear ID verification?",
    // not "do they have an enabled rail elsewhere?" — read the identity
    // signal directly (Sumsub-cleared the human) instead of the old
    // rail-approval proxy. Same fix-pattern as Profile/ProfileEdit.
    const { rails, nextActions, isLoading: areCapabilitiesLoading } = useCapabilities()
    const { isVerified: isUserIdentityVerified } = useIdentityVerification()
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA', nextActions), [rails, nextActions])
    const currencyData = useCurrency(selectedCountry?.currency ?? 'ARS')
    // inline sumsub kyc flow for manteca users who need LATAM verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('LATAM')
    const sumsubFlow = useMultiPhaseKycFlow({})
    const [showKycModal, setShowKycModal] = useState(false)
    // Dismissing the gate must not re-open it on the next render — same
    // one-shot prompt contract as QrPayKycGateView's kycPromptDismissed.
    const [kycGateDismissed, setKycGateDismissed] = useState(false)
    const isUserMantecaKycApprovedForCountry = selectedCountry ? isVerifiedForCountry(rails, selectedCountry.id) : false

    // The gate comes before the amount: a user who cannot deposit should learn it
    // on arrival, not after typing a number. The amount screen stays mounted
    // underneath, so dismissing the drawer shows what Continue is waiting on.
    // Wait for capabilities first — opening while they load flashes the gate at a
    // verified user.
    useEffect(() => {
        // a non-resident sees the residence screen, not the KYC gate — Manteca
        // would reject the verification anyway
        if (requiresResidenceGate) return
        if (areCapabilitiesLoading) return
        if (isUserMantecaKycApprovedForCountry) return
        if (kycGateDismissed) return
        setShowKycModal(true)
    }, [requiresResidenceGate, areCapabilitiesLoading, isUserMantecaKycApprovedForCountry, kycGateDismissed])

    // validates deposit amount against user's limits
    // currency comes from country config - hook normalizes it internally
    const limitsValidation = useLimitsValidation({
        flowType: 'onramp',
        amount: usdAmount,
        currency: selectedCountry?.currency,
    })

    // Validate USD amount (min check only - max is handled by limits validation)
    useEffect(() => {
        // if user hasn't entered any amount yet, don't show error
        if (!displayedAmount || displayedAmount === '0') {
            setValidationError(null)
            return
        }

        // user has entered something - validate the USD equivalent
        // if USD amount is effectively zero or too small, show minimum error
        if (!usdAmount || usdAmount === '0.00') {
            setValidationError(t('manteca.minDepositAmount', { amount: MIN_MANTECA_DEPOSIT_AMOUNT }))
            return
        }

        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount < parseUnits(MIN_MANTECA_DEPOSIT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setValidationError(t('manteca.minDepositAmount', { amount: MIN_MANTECA_DEPOSIT_AMOUNT }))
        } else {
            setValidationError(null)
        }
    }, [usdAmount, displayedAmount, t])

    // Invalidate transactions query when entering deposit details step
    useEffect(() => {
        if (step === 'depositDetails') {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [step, queryClient])

    // Handle displayed amount change - save to URL
    // This is called by AmountInput with the currently DISPLAYED value
    const handleDisplayedAmountChange = useCallback(
        (value: string) => {
            setUrlState({ amount: value || null }) // null removes from URL
        },
        [setUrlState]
    )

    // Handle local currency amount change (primary in AmountInput)
    const handleLocalCurrencyAmountChange = useCallback((value: string | undefined) => {
        setLocalCurrencyAmount(value ?? '')
    }, [])

    // Handle USD amount change (secondary in AmountInput)
    const handleUsdAmountChange = useCallback((value: string) => {
        setUsdAmount(value)
    }, [])

    // Handle currency denomination change - sync to URL state.
    // AmountInput reports the DISPLAY symbol ('R$', 'ARS', 'USD'); the URL enum stores
    // ISO codes, so map anything that isn't USD back to the country's currency code —
    // otherwise Brazil writes ?currency=R$ which the enum parser silently rejects.
    const handleDenominationChange = useCallback(
        (value: string) => {
            const code = value === 'USD' ? 'USD' : (selectedCountry?.currency ?? value)
            setUrlState({ currency: code as CurrencyDenomination })
        },
        [setUrlState, selectedCountry?.currency]
    )

    const closeKycModal = useCallback(() => {
        setShowKycModal(false)
        setKycGateDismissed(true)
    }, [])

    const handleAmountSubmit = useCallback(async () => {
        if (!selectedCountry?.currency) return
        if (isCreatingDeposit) return

        if (!isUserMantecaKycApprovedForCountry) {
            setShowKycModal(true)
            return
        }

        try {
            setError(null)
            setIsCreatingDeposit(true)

            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_AMOUNT_ENTERED, {
                amount_usd: usdAmount,
                method_type: 'manteca',
                country: selectedCountryPath,
                denomination: currentDenomination,
            })

            const isUsdDenominated = currentDenomination === 'USD'
            // Use the displayed amount for the API call
            const amount = displayedAmount
            const depositData = await mantecaApi.deposit({
                amount: amount!,
                isUsdDenominated,
                currency: selectedCountry.currency,
            })
            if (depositData.error) {
                posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                    method_type: 'manteca',
                    country: selectedCountryPath,
                    error_message: depositData.error,
                })
                setError(depositData.error)
                return
            }
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_CONFIRMED, {
                amount_usd: usdAmount,
                method_type: 'manteca',
                country: selectedCountryPath,
            })
            // BRL deposits carry the dynamic PIX QR in the ramp-on synthetic's
            // details → show the QR step. ARS/others show deposit details.
            const data = depositData.data
            setDepositDetails(data)
            if (selectedCountry?.currency === 'BRL') {
                setUrlState({ step: 'showQR' })
            } else {
                setUrlState({ step: 'depositDetails' })
            }
        } catch (error) {
            console.log(error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_FAILED, {
                method_type: 'manteca',
                error_message: errorMessage,
            })
            setError(errorMessage)
        } finally {
            setIsCreatingDeposit(false)
        }
    }, [
        currentDenomination,
        selectedCountry,
        displayedAmount,
        isUserMantecaKycApprovedForCountry,
        isCreatingDeposit,
        setUrlState,
        usdAmount,
        selectedCountryPath,
    ])

    // Redirect to inputAmount if depositDetails is accessed without required data (deep link / back navigation)
    useEffect(() => {
        if (step === 'depositDetails' && !depositDetails) {
            setUrlState({ step: 'inputAmount' })
        }
        if (step === 'showQR' && !depositDetails) {
            setUrlState({ step: 'inputAmount' })
        }
    }, [step, depositDetails, setUrlState])

    if (!selectedCountry) return null

    // A non-resident cannot open the Manteca top-up, so the rule comes before
    // the amount screen and the KYC drawer — with a back to the hub, and the
    // QR route that still works from any balance.
    if (residenceGatedCountry && requiresResidenceGate) {
        return (
            <ResidenceRequiredScreen
                residenceIso2={residenceGatedCountry}
                qrPayHref="/qr-pay"
                residenceChangeHref={withReturnTo(
                    '/profile/accounts-and-payments?open=residence',
                    '/add-money?method=bank'
                )}
                onBack={onBack}
            />
        )
    }

    // While the BRL PIX deposit request is in flight (the QR is being generated),
    // show the branded processing screen — same as when a PIX payment is processing.
    if (isCreatingDeposit && selectedCountry.currency === 'BRL') {
        return (
            <div className="my-auto flex min-h-inherit flex-col justify-center">
                {/* the deposit request is in flight — title only, no
                    "confirming" claim before any money moved (TASK-22452) */}
                <ProcessingScreen title={t('processingDepositTitle')} />
            </div>
        )
    }

    if (step === 'inputAmount') {
        return (
            <>
                <InitiateKycModal
                    cooldownActive={!!sumsubFlow.errorCooldown}
                    prepPath="extended"
                    taxIdCountry={selectedCountry?.id === 'BR' ? 'BR' : selectedCountry?.id === 'AR' ? 'AR' : undefined}
                    visible={showKycModal}
                    onClose={closeKycModal}
                    onVerify={async () => {
                        if (mantecaRejection.state === 'blocked') {
                            // blocked users cannot self-heal — route to support
                            if (typeof window !== 'undefined' && window.$crisp) {
                                window.$crisp.push(['do', 'chat:open'])
                            }
                            closeKycModal()
                            return
                        }
                        if (mantecaRejection.state === 'restart-identity') {
                            await sumsubFlow.handleRestartIdentity()
                        } else if (mantecaRejection.state === 'fixable') {
                            await sumsubFlow.handleFixableRejection(mantecaRejection)
                        } else {
                            await sumsubFlow.handleInitiateKyc('LATAM', undefined, true, selectedCountry?.id)
                        }
                        closeKycModal()
                    }}
                    isLoading={sumsubFlow.isLoading}
                    variant={
                        mantecaRejection.state === 'blocked'
                            ? 'blocked'
                            : mantecaRejection.state === 'restart-identity'
                              ? 'restart_identity'
                              : mantecaRejection.state === 'fixable'
                                ? 'provider_rejection'
                                : isUserIdentityVerified
                                  ? 'cross_region'
                                  : // not verified yet, and we know which country they came for:
                                    // what they unlock is that country's transfers and payments
                                    'country_payments'
                    }
                    providerMessage={mantecaRejection.userMessage ?? undefined}
                    reasonCode={mantecaRejection.reasonCode ?? undefined}
                    regionName={selectedCountry && localizedCountryTitle(locale, selectedCountry)}
                />
                <SumsubKycModals flow={sumsubFlow} onCooldownClose={closeKycModal} />
                <InputAmountStep
                    tokenAmount={displayedAmount}
                    setTokenAmount={handleUsdAmountChange}
                    onSubmit={handleAmountSubmit}
                    isLoading={isCreatingDeposit}
                    error={error || sumsubFlow.error}
                    validationError={validationError}
                    currencyData={currencyData}
                    setCurrencyAmount={handleLocalCurrencyAmountChange}
                    setCurrentDenomination={handleDenominationChange}
                    initialDenomination={currentDenomination}
                    setDisplayedAmount={handleDisplayedAmountChange}
                    limitsValidation={limitsValidation}
                    limitsCurrency={limitsValidation.currency}
                    onBack={onBack}
                />
            </>
        )
    }

    if (step === 'depositDetails') {
        // Show nothing while useEffect redirects if data is missing
        if (!depositDetails) {
            return null
        }
        return (
            <MantecaDepositShareDetails
                depositDetails={depositDetails}
                currencyAmount={localCurrencyAmount}
                // Settled screen: the deposit is already created. Leave the flow the
                // way the input step does, not back to `inputAmount` (which would let
                // the user start a second deposit).
                onBack={onBack}
            />
        )
    }

    if (step === 'showQR') {
        if (!depositDetails) {
            return null
        }
        return (
            <MantecaPixQrDeposit
                depositDetails={depositDetails}
                currencyAmount={localCurrencyAmount}
                // Settled screen: the deposit is already created. Back leaves the flow
                // the way the input step does, not to `inputAmount` (which would let the
                // user start a second deposit).
                onBack={onBack}
                // Terminal exit — `replace` so device/browser back can't pop into the
                // finished deposit (whose step=showQR would redirect to a new one).
                onDone={() => router.replace('/home')}
                onComplete={() => queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })}
            />
        )
    }

    return null
}

export default MantecaAddMoney
