'use client'

import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { useStaleSessionGuard } from '@/hooks/wallet/useStaleSessionGuard'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/useSpendBundle'
import { rainCollateralErrorMessage } from '@/utils/friendly-error.utils'
import { rainCentsToUsdcUnits, SPEND_BLOCK_MESSAGE } from '@/utils/balance.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useState, useMemo, useContext, useEffect, useCallback, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { mantecaApi, type WithdrawPriceLock } from '@/services/manteca'
import { useCurrency } from '@/hooks/useCurrency'
import { loadingStateContext } from '@/context/loadingStates.context'
import { countryData } from '@/components/AddMoney/consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import Image from 'next/image'
import { formatNumberForDisplay } from '@/utils/general.utils'
import { validateCbuCvuAlias, validatePixKey, normalizePixInput, isPixEmvcoQr } from '@/utils/withdraw.utils'
import ValidatedInput from '@/components/Global/ValidatedInput'
import AmountInput from '@/components/Global/AmountInput'
import { parseUnits } from 'viem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useModalsContext } from '@/context/ModalsContext'
import Select from '@/components/Global/Select'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useQueryClient } from '@tanstack/react-query'
import { captureException } from '@sentry/nextjs'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import { deriveProviderRejection } from '@/utils/provider-rejection.utils'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { PointsAction } from '@/services/services.types'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import PointsCard from '@/components/Common/PointsCard'
import {
    MANTECA_COUNTRIES_CONFIG,
    MANTECA_DEPOSIT_ADDRESS,
    MantecaAccountType,
    isMantecaSupportedCountryCode,
    type MantecaBankCode,
} from '@/constants/manteca.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import { MIN_MANTECA_WITHDRAW_AMOUNT } from '@/constants/payment.consts'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps, isBrUserEligibleForLimitIncrease } from '@/features/limits/utils'
import { withdrawCountryUrl } from '@/utils/native-routes'
import { useSumsubActionFlow } from '@/hooks/useSumsubActionFlow'
import { initiateIncreaseLimits } from '@/app/actions/increase-limits'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'
import { useLimits } from '@/hooks/useLimits'
import { isVerifiedForCountry } from '@/utils/regions.utils'
import PixKeySendView from '@/components/Withdraw/views/PixKeySend.view'

type MantecaWithdrawStep = 'amountInput' | 'bankDetails' | 'review' | 'success' | 'failure'

export default function MantecaWithdrawFlow() {
    const searchParams = useSearchParams()
    // Brazil PIX sends go through the Manteca QR-payment endpoint (send to any
    // PIX key), not the offramp/withdraw endpoint. Delegate to the lightweight
    // PIX-key entry, which wraps the key and hands off to /qr-pay. The gate
    // there (canDo('pay', { provider: 'manteca' })) is broader than the full
    // Manteca KYC the withdraw flow requires — so PIX-pay-capable users get
    // through. All Brazil-PIX entry points funnel here, so this is the single
    // chokepoint that flips the endpoint without touching the AR / bank paths.
    if (searchParams.get('country') === 'brazil' && searchParams.get('method') === 'pix') {
        return <PixKeySendView destinationParam={searchParams.get('destination')} />
    }
    return <MantecaBankWithdrawFlow />
}

function MantecaBankWithdrawFlow() {
    const flowId = useId() // Unique ID per flow instance to prevent cache collisions
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [usdAmount, setUsdAmount] = useState<string | undefined>(undefined)
    // store original currency amount before price lock to restore on back navigation
    const [originalCurrencyAmount, setOriginalCurrencyAmount] = useState<string | undefined>(undefined)
    const [step, setStep] = useState<MantecaWithdrawStep>('amountInput')
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const searchParams = useSearchParams()
    const paramAddress = searchParams.get('destination')
    const isSavedAccount = searchParams.get('isSavedAccount') === 'true'
    const [destinationAddress, setDestinationAddress] = useState<string>(paramAddress ?? '')
    const [selectedBank, setSelectedBank] = useState<MantecaBankCode | null>(null)
    const [accountType, setAccountType] = useState<MantecaAccountType | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isDestinationAddressValid, setIsDestinationAddressValid] = useState(false)
    const [isDestinationAddressChanging, setIsDestinationAddressChanging] = useState(false)
    // price lock state - holds the locked price from /withdraw/init
    const [priceLock, setPriceLock] = useState<WithdrawPriceLock | null>(null)
    const [isLockingPrice, setIsLockingPrice] = useState(false)
    const router = useRouter()
    const { spendableBalance: balance, formattedSpendableBalance, spendBlockReason } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const handleStaleSession = useStaleSessionGuard()
    const { overview: rainCardOverview } = useRainCardOverview()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const { setIsSupportModalOpen, openSupportWithMessage } = useModalsContext()
    const queryClient = useQueryClient()
    // The pool→full upgrade gate reads identityVerification (Sumsub-cleared
    // the human), not rail-approval. Same fix-pattern as Profile/ProfileEdit.
    const { rails } = useCapabilities()
    const { isVerified: isUserIdentityVerified } = useIdentityVerification()
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA'), [rails])
    const { hasPendingTransactions } = usePendingTransactions()

    // inline sumsub kyc flow for manteca users who need LATAM verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('LATAM')
    const sumsubFlow = useMultiPhaseKycFlow({})
    const [showKycModal, setShowKycModal] = useState(false)
    const [isRedirectingToOnboarding, setIsRedirectingToOnboarding] = useState(false)

    // Get method and country from URL parameters
    const selectedMethodType = searchParams.get('method') // mercadopago, pix, bank-transfer, etc.
    const countryFromUrl = searchParams.get('country') // argentina, brazil, etc.
    const countryPath = countryFromUrl

    // Map country path to CountryData for KYC
    const selectedCountry = useMemo(() => {
        if (!countryPath) return undefined
        return countryData.find((country) => country.type === 'country' && country.path === countryPath)
    }, [countryPath])

    const onBack = useSafeBack(withdrawCountryUrl(selectedCountry?.path || ''))

    const countryConfig = useMemo(() => {
        if (!selectedCountry || !isMantecaSupportedCountryCode(selectedCountry.id)) return undefined
        return MANTECA_COUNTRIES_CONFIG[selectedCountry.id]
    }, [selectedCountry])
    const isUserMantecaKycApprovedForCountry = selectedCountry ? isVerifiedForCountry(rails, selectedCountry.id) : false

    const {
        code: currencyCode,
        price: currencyPrice,
        isLoading: isCurrencyLoading,
    } = useCurrency(selectedCountry?.currency ?? null)

    // validates withdrawal against user's limits
    // currency comes from country config - hook normalizes it internally
    const limitsValidation = useLimitsValidation({
        flowType: 'offramp',
        amount: usdAmount,
        currency: selectedCountry?.currency,
    })

    // BR self-service limit increase flow
    const { mantecaLimits, refetch: refetchLimits } = useLimits()
    const isBrEligible = isBrUserEligibleForLimitIncrease(mantecaLimits)
    const limitIncreaseFlow = useSumsubActionFlow({
        fetchToken: initiateIncreaseLimits,
        onSuccess: refetchLimits,
        onNeedsSupport: () => openSupportWithMessage('Hi, I would like to increase my payment limits.'),
    })

    // Get country flag code
    const countryFlagCode = useMemo(() => {
        return selectedCountry?.iso2?.toLowerCase()
    }, [selectedCountry])

    // Get method display info
    const methodDisplayInfo = useMemo(() => {
        const methodNames: { [key: string]: string } = {
            mercadopago: 'MercadoPago',
            pix: 'Pix',
            'bank-transfer': 'Bank Transfer',
        }

        return {
            name: methodNames[selectedMethodType || 'bank-transfer'] || 'Bank Transfer',
        }
    }, [selectedMethodType])

    const validateDestinationAddress = async (value: string) => {
        value = value.trim()
        if (!value) {
            return false
        }

        let isValid = false
        switch (countryPath) {
            case 'argentina':
                const argResult = validateCbuCvuAlias(value)
                isValid = argResult.valid
                if (!argResult.valid) {
                    setErrorMessage(argResult.message!)
                }
                break
            case 'brazil':
                value = isPixEmvcoQr(value.trim()) ? value.trim() : value.replace(/\s/g, '')
                const pixResult = validatePixKey(value)
                isValid = pixResult.valid
                if (!pixResult.valid) {
                    setErrorMessage(pixResult.message!)
                }
                break
            default:
                isValid = true
                break
        }

        return isValid
    }

    /**
     * Detect Manteca onboarding-incomplete errors and redirect user to complete their profile.
     * Returns true if the error was handled (caller should return early).
     *
     * INTENTIONAL FALLBACK — NOT a primary code path. The KYC 2.0 architecture
     * (engineering/projects/kyc-2.0/final-plan.md) centralizes all data
     * collection in Sumsub and submits to Manteca via the API (`submitToManteca`
     * in peanut-api-ts). The Manteca hosted onboarding widget is dead-by-design
     * — but we keep this last-resort redirect for the long tail of users who
     * land in an incomplete Manteca state (partial provisioning, undelivered
     * initial-onboarding API call). Without this escape hatch they'd be stuck
     * at withdraw time with no actionable error.
     *
     * Right fix: root-cause why `submitToManteca` sometimes leaves users
     * half-onboarded, fix that, delete this fallback + `/manteca/initiate-onboarding`
     * route + `mantecaApi.initiateOnboarding` client. Tracked separately.
     */
    const handleOnboardingError = useCallback(async (error: string): Promise<boolean> => {
        const onboardingErrorPatterns = ['fund origin', 'profile incomplete', 'onboarding required']
        const normalizedError = error.toLowerCase()
        const isOnboardingError = onboardingErrorPatterns.some((pattern) => normalizedError.includes(pattern))
        if (!isOnboardingError) return false

        setIsRedirectingToOnboarding(true)
        try {
            const result = await mantecaApi.initiateOnboarding({
                returnUrl: window.location.href,
            })
            window.location.href = result.url
        } catch {
            setErrorMessage('Please complete your account setup. Go to Settings to update your profile.')
            setIsRedirectingToOnboarding(false)
        }
        return true
    }, [])

    const isCompleteBankDetails = useMemo<boolean>(() => {
        return (
            !!destinationAddress.trim() &&
            (!countryConfig?.needsBankCode || selectedBank != null) &&
            (!countryConfig?.needsAccountType || accountType != null)
        )
    }, [selectedBank, accountType, countryConfig, destinationAddress])

    const handleBankDetailsSubmit = useCallback(async () => {
        // prevent duplicate requests from rapid clicks
        if (isLockingPrice) return

        if (!destinationAddress.trim()) {
            setErrorMessage('Please enter your account address')
            return
        }
        if ((countryConfig?.needsBankCode && !selectedBank) || (countryConfig?.needsAccountType && !accountType)) {
            setErrorMessage('Please complete the bank details')
            return
        }
        setErrorMessage(null)

        if (!isUserMantecaKycApprovedForCountry) {
            setShowKycModal(true)
            return
        }

        // lock the price before showing review screen
        // this ensures user sees the exact amount they'll receive
        if (!usdAmount || !currencyCode) return

        setIsLockingPrice(true)
        try {
            const result = await mantecaApi.initiateWithdraw({
                amount: usdAmount,
                currency: currencyCode,
            })

            if (result.error) {
                if (await handleOnboardingError(result.error)) return
                setErrorMessage(result.error)
                return
            }

            if (result.data) {
                // store original amount before overwriting so we can restore on back navigation
                setOriginalCurrencyAmount(currencyAmount)
                setPriceLock(result.data)
                // update the displayed fiat amount to the locked amount
                setCurrencyAmount(result.data.fiatAmount)
                setStep('review')
            }
        } catch (error) {
            captureException(error)
            setErrorMessage('Could not lock exchange rate. Please try again.')
        } finally {
            setIsLockingPrice(false)
        }
    }, [
        selectedBank,
        accountType,
        destinationAddress,
        countryConfig?.needsBankCode,
        countryConfig?.needsAccountType,
        usdAmount,
        currencyCode,
        currencyAmount,
        isUserMantecaKycApprovedForCountry,
        isLockingPrice,
        handleOnboardingError,
    ])

    const handleWithdraw = async () => {
        if (!destinationAddress || !usdAmount || !currencyCode || !priceLock) return

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_CONFIRMED, {
            amount_usd: usdAmount,
            method_type: 'manteca',
            country: countryPath,
        })

        try {
            setLoadingState('Preparing transaction')

            // Step 1: Sign the spend artifact (but don't broadcast yet).
            // Route across smart-only / mixed / collateral-only — pure-collateral
            // offramps (smart wallet empty, card collateral covers it) used to
            // fail here because signTransferUserOp asks the paymaster to
            // simulate a USDC transfer from a zero-balance smart account, which
            // ZeroDev refuses to sponsor. signSpend picks the right routing,
            // including a single-tap collateral-only path that lets Rain
            // transfer straight from the collateral proxy to MANTECA's deposit
            // address.
            let signedArtifact
            try {
                const requiredUsdcAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
                signedArtifact = await signSpend({
                    requiredUsdcAmount,
                    recipient: MANTECA_DEPOSIT_ADDRESS,
                    rainSpendingPower: rainCentsToUsdcUnits(rainCardOverview?.balance?.spendingPower),
                    kind: 'FIAT_OFFRAMP',
                })
            } catch (error) {
                const rainMsg = rainCollateralErrorMessage(error)
                if (error instanceof InsufficientSpendableError) {
                    setErrorMessage('Not enough USDC in your wallet or card to cover this withdrawal.')
                } else if (error instanceof SessionKeyGrantRequiredError) {
                    // Grant prompt was attempted inside signSpend and failed.
                    // Telling the user "you'll be asked" is misleading — they
                    // may retry and hit the same loop. Give an actionable hint.
                    setErrorMessage('Card authorization failed. Please try again or contact support.')
                } else if (rainMsg) {
                    setErrorMessage(rainMsg)
                } else if ((error as Error).toString().includes('not allowed')) {
                    setErrorMessage('Please confirm the transaction.')
                } else {
                    captureException(error)
                    setErrorMessage('Could not sign the transaction.')
                }
                setLoadingState('Idle')
                return
            }

            setLoadingState('Withdrawing')

            // Step 2: Send signed artifact to backend. Backend creates the
            // Manteca order FIRST, then either broadcasts the signed UserOp
            // (smart-only / mixed) or submits the Rain withdrawal via the
            // user's session-key UserOp (collateral-only). No stuck funds.
            const result = await mantecaApi.withdrawWithSignedTx(
                signedArtifact.strategy === 'collateral-only'
                    ? {
                          kind: 'rainWithdrawal' as const,
                          priceLockCode: priceLock.priceLockCode,
                          amount: usdAmount,
                          destinationAddress: destinationAddress.toLowerCase(),
                          bankCode: selectedBank?.code,
                          accountType: accountType ?? undefined,
                          currency: currencyCode,
                          signedRainWithdrawal: signedArtifact.rainWithdrawal,
                          chainId: PEANUT_WALLET_CHAIN.id.toString(),
                      }
                    : {
                          kind: 'userOp' as const,
                          priceLockCode: priceLock.priceLockCode,
                          amount: usdAmount,
                          destinationAddress: destinationAddress.toLowerCase(),
                          bankCode: selectedBank?.code,
                          accountType: accountType ?? undefined,
                          currency: currencyCode,
                          signedUserOp: signedArtifact.signedUserOp.signedUserOp,
                          chainId: signedArtifact.signedUserOp.chainId,
                          entryPointAddress: signedArtifact.signedUserOp.entryPointAddress,
                          // For mixed: tell backend about the Rain prepare intent
                          // embedded in the UserOp's batched callData so it can
                          // reconcile the collateral webhook to OFFRAMP in history.
                          ...(signedArtifact.strategy === 'mixed'
                              ? { rainPreparationId: signedArtifact.rainPreparationId }
                              : {}),
                      }
            )

            if (result.error) {
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                    method_type: 'manteca',
                    error_message: result.error,
                })

                // Wrong-passkey session: backend rejected the signed UserOp with
                // AA24 / wapk. Unrecoverable without re-auth — force a clean logout.
                if (handleStaleSession(result.message ?? result.error)) return

                // handle onboarding-incomplete errors by redirecting to complete profile
                if (await handleOnboardingError(result.message ?? result.error)) return

                // handle third-party account error with user-friendly message
                if (result.error === 'TAX_ID_MISMATCH' || result.error === 'CUIT_MISMATCH') {
                    setErrorMessage('You can only withdraw to accounts under your name.')
                } else if (result.error === 'Unexpected error') {
                    setErrorMessage('Withdraw failed unexpectedly. If problem persists contact support')
                    setStep('failure')
                } else {
                    setErrorMessage(result.message ?? result.error)
                }
                return
            }

            setStep('success')
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_COMPLETED, {
                amount_usd: usdAmount,
                method_type: 'manteca',
                country: countryPath,
            })
        } catch (error) {
            console.error('Manteca withdraw error:', error)
            if (handleStaleSession(error)) return
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                method_type: 'manteca',
                error_message: 'Withdraw failed unexpectedly',
            })
            setErrorMessage('Withdraw failed unexpectedly. If problem persists contact support')
            setStep('failure')
        } finally {
            setLoadingState('Idle')
        }
    }

    const resetState = () => {
        setStep('amountInput')
        setCurrencyAmount(undefined)
        setUsdAmount(undefined)
        setOriginalCurrencyAmount(undefined)
        setDestinationAddress(paramAddress ?? '')
        setSelectedBank(null)
        setAccountType(null)
        setErrorMessage(null)
        setIsDestinationAddressValid(false)
        setIsDestinationAddressChanging(false)
        setBalanceErrorMessage(null)
        setPriceLock(null)
        setIsLockingPrice(false)
    }

    useEffect(() => {
        resetState()
    }, [])

    useEffect(() => {
        // Skip balance check if transaction is being processed
        // Use hasPendingTransactions to prevent race condition with optimistic updates
        // isLoading covers the gap between sendMoney completing and API withdraw completing
        if (hasPendingTransactions || isLoading) {
            return
        }

        if (!usdAmount || usdAmount === '0.00' || isNaN(Number(usdAmount)) || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        // only check min amount and balance here - max amount is handled by limits validation
        if (paymentAmount < parseUnits(MIN_MANTECA_WITHDRAW_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`Withdraw amount must be at least $${MIN_MANTECA_WITHDRAW_AMOUNT}`)
        } else {
            // available-now gate; 'settling' covers the brief card top-up window
            // where the displayed balance reads higher than what's routable.
            const block = spendBlockReason(usdAmount)
            setBalanceErrorMessage(block ? SPEND_BLOCK_MESSAGE[block] : null)
        }
    }, [usdAmount, balance, spendBlockReason, hasPendingTransactions, isLoading])

    // Fetch points early to avoid latency penalty - fetch as soon as we have usdAmount
    // Use flowId as uniqueId to prevent cache collisions between different withdrawal flows
    const { pointsData, pointsDivRef } = usePointsCalculation(PointsAction.MANTECA_TRANSFER, usdAmount, true, flowId)

    // Use points confetti hook for animation - must be called unconditionally
    usePointsConfetti(step === 'success' ? pointsData?.estimatedPoints : undefined, pointsDivRef)

    useEffect(() => {
        if (step === 'success') {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [step, queryClient])

    // redirect to withdraw page if country is missing or not supported by manteca
    useEffect(() => {
        if (!countryFromUrl || !selectedCountry || !isMantecaSupportedCountryCode(selectedCountry.id)) {
            router.replace('/withdraw')
        }
    }, [countryFromUrl, selectedCountry, router])

    if (isCurrencyLoading || !currencyPrice || !selectedCountry || !countryConfig) {
        return <PeanutLoading />
    }

    if (step === 'success') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <SoundPlayer sound="success" />
                <NavHeader title="Withdraw" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold">
                                <Icon name="check" size={24} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">You just withdrew</h1>
                            <div className="text-2xl font-extrabold">
                                {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                            </div>
                            <div className="text-lg font-bold">
                                ≈ ${formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                            </div>
                            <h1 className="text-sm font-normal text-grey-1">to {destinationAddress}</h1>
                        </div>
                    </Card>

                    {/* Points Display - ref used for confetti origin point */}
                    {pointsData?.estimatedPoints && (
                        <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                    )}

                    <div className="w-full space-y-5">
                        <Button
                            onClick={() => {
                                router.push('/home')
                                resetState()
                            }}
                            shadowSize="4"
                        >
                            Back to home
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'failure') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Withdraw" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="shadow-4">
                        <Card.Header>
                            <Card.Title>Something went wrong!</Card.Title>
                            <Card.Description>{errorMessage}</Card.Description>
                        </Card.Header>
                        <Card.Content className="flex flex-col gap-3">
                            <Button onClick={resetState} variant="purple">
                                Try again
                            </Button>
                            <Button
                                onClick={() => setIsSupportModalOpen(true)}
                                variant="transparent"
                                className="text-sm underline"
                            >
                                Contact Support
                            </Button>
                        </Card.Content>
                    </Card>
                </div>
            </div>
        )
    }
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <InitiateKycModal
                visible={showKycModal}
                onClose={() => setShowKycModal(false)}
                onVerify={async () => {
                    if (mantecaRejection.state === 'blocked') {
                        // blocked users cannot self-heal — route to support
                        const crisp =
                            typeof window !== 'undefined'
                                ? (window as Window & { $crisp?: string[][] }).$crisp
                                : undefined
                        if (crisp) {
                            crisp.push(['do', 'chat:open'])
                        }
                        setShowKycModal(false)
                        return
                    }
                    if (mantecaRejection.state === 'restart-identity') {
                        await sumsubFlow.handleRestartIdentity()
                    } else if (mantecaRejection.state === 'fixable') {
                        await sumsubFlow.handleSelfHealResubmit('MANTECA')
                    } else {
                        await sumsubFlow.handleInitiateKyc('LATAM', undefined, true, selectedCountry?.id)
                    }
                    setShowKycModal(false)
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
                              : 'default'
                }
                providerMessage={mantecaRejection.userMessage ?? undefined}
                regionName={selectedCountry?.title}
            />
            <SumsubKycModals flow={sumsubFlow} />
            <SumsubKycWrapper
                visible={limitIncreaseFlow.showWrapper}
                accessToken={limitIncreaseFlow.accessToken}
                onClose={limitIncreaseFlow.handleClose}
                onComplete={limitIncreaseFlow.handleSdkComplete}
                onRefreshToken={limitIncreaseFlow.refreshToken}
                autoStart
                isMultiLevel
            />
            <NavHeader
                title="Withdraw"
                onPrev={() => {
                    if (step === 'review') {
                        // clear price lock and restore original amount when going back
                        setPriceLock(null)
                        if (originalCurrencyAmount) {
                            setCurrencyAmount(originalCurrencyAmount)
                            setOriginalCurrencyAmount(undefined)
                        }
                        setStep('bankDetails')
                    } else if (step === 'bankDetails') {
                        setStep('amountInput')
                    } else {
                        onBack()
                    }
                }}
            />

            {step === 'amountInput' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <div className="text-xl font-bold">Amount to withdraw</div>
                    <AmountInput
                        initialAmount={currencyAmount}
                        setPrimaryAmount={setCurrencyAmount}
                        setSecondaryAmount={setUsdAmount}
                        primaryDenomination={{
                            symbol: currencyCode!,
                            price: currencyPrice!.sell,
                            decimals: 2,
                        }}
                        secondaryDenomination={{
                            symbol: 'USD',
                            price: 1,
                            decimals: 2,
                        }}
                        walletBalance={balance !== undefined ? formattedSpendableBalance : undefined}
                    />

                    {/* limits warning/error card - uses centralized helper for props */}
                    {(() => {
                        const limitsCardProps = getLimitsWarningCardProps({
                            validation: limitsValidation,
                            flowType: 'offramp',
                            currency: limitsValidation.currency,
                        })
                        if (!limitsCardProps) return null
                        return (
                            <LimitsWarningCard
                                {...limitsCardProps}
                                onIncreaseLimits={
                                    isBrEligible && limitsValidation.isBlocking
                                        ? limitIncreaseFlow.handleInitiate
                                        : undefined
                                }
                                isIncreaseLimitsLoading={limitIncreaseFlow.isLoading}
                            />
                        )
                    })()}

                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            if (usdAmount) {
                                // If coming from saved account flow, skip bank details step and go to review
                                if (isSavedAccount) {
                                    handleBankDetailsSubmit()
                                } else {
                                    setStep('bankDetails')
                                }
                            }
                        }}
                        disabled={!Number(usdAmount) || !!balanceErrorMessage || limitsValidation.isBlocking}
                        className="w-full"
                    >
                        Continue
                    </Button>
                    {/* only show balance error if limits blocking card is not displayed (warnings can coexist) */}
                    {balanceErrorMessage && !limitsValidation.isBlocking && (
                        <ErrorAlert description={balanceErrorMessage} />
                    )}
                </div>
            )}

            {step === 'bankDetails' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    {/* Amount Display Card */}
                    <Card className="p-4">
                        <div className="flex items-center space-x-3">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={getFlagUrl(countryFlagCode)}
                                    alt={`flag`}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-1">
                                    <Icon name="bank" size={12} />
                                </div>
                            </div>
                            <div>
                                <p className="flex items-center gap-1 text-center text-sm text-gray-600">
                                    <Icon name="arrow-up" size={10} /> You're sending
                                </p>
                                <p className="text-2xl font-bold">
                                    {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                                </p>
                                <div className="text-lg font-bold">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Bank Details Form */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">Enter {methodDisplayInfo.name} details</h2>
                        <div className="space-y-2">
                            <ValidatedInput
                                value={destinationAddress}
                                placeholder={countryConfig!.accountNumberLabel}
                                onUpdate={(update) => {
                                    // Auto-normalize PIX keys for Brazil: strip whitespace and normalize phone numbers
                                    const normalizedValue =
                                        countryPath === 'brazil' ? normalizePixInput(update.value) : update.value
                                    setDestinationAddress(normalizedValue)
                                    setIsDestinationAddressValid(update.isValid)
                                    setIsDestinationAddressChanging(update.isChanging)
                                    if (update.isValid || update.value === '') {
                                        setErrorMessage(null)
                                    }
                                }}
                                validate={validateDestinationAddress}
                            />
                            {countryConfig?.needsAccountType && (
                                <Select
                                    value={accountType ? { id: accountType, title: accountType } : null}
                                    onChange={(item) => {
                                        setAccountType(MantecaAccountType[item.id as keyof typeof MantecaAccountType])
                                    }}
                                    items={countryConfig.validAccountTypes.map((type) => ({ id: type, title: type }))}
                                    placeholder="Select account type"
                                    className="w-full"
                                />
                            )}
                            {countryConfig?.needsBankCode && (
                                <Select
                                    value={selectedBank ? { id: selectedBank.code, title: selectedBank.name } : null}
                                    onChange={(item) => {
                                        setSelectedBank({ code: item.id, name: item.title })
                                    }}
                                    items={countryConfig.validBankCodes.map((bank) => ({
                                        id: bank.code,
                                        title: bank.name,
                                    }))}
                                    placeholder="Select bank"
                                    className="w-full"
                                />
                            )}

                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Icon name="info" size={16} />
                                <span>You can only withdraw to accounts under your name.</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleBankDetailsSubmit}
                            disabled={
                                !isCompleteBankDetails ||
                                isDestinationAddressChanging ||
                                !isDestinationAddressValid ||
                                isLockingPrice ||
                                isRedirectingToOnboarding
                            }
                            loading={isDestinationAddressChanging || isLockingPrice || isRedirectingToOnboarding}
                            className="w-full"
                            shadowSize="4"
                        >
                            {isRedirectingToOnboarding
                                ? 'Redirecting...'
                                : isLockingPrice
                                  ? 'Locking rate...'
                                  : 'Review'}
                        </Button>

                        {(errorMessage || sumsubFlow.error) && (
                            <ErrorAlert description={(errorMessage || sumsubFlow.error)!} />
                        )}
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="p-4">
                        <div className="flex items-center space-x-3">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={getFlagUrl(countryFlagCode)}
                                    alt={`flag`}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-1">
                                    <Icon name="bank" size={12} />
                                </div>
                            </div>
                            <div>
                                <p className="flex items-center gap-1 text-center text-sm text-gray-600">
                                    <Icon name="arrow-up" size={10} /> You're sending
                                </p>
                                <p className="text-2xl font-bold">
                                    {currencyCode}{' '}
                                    {formatNumberForDisplay(priceLock?.fiatAmount ?? currencyAmount, {
                                        maxDecimals: 2,
                                    })}
                                </p>
                                <div className="text-lg font-bold">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>
                    {/* Review Summary */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow label={countryConfig!.accountNumberLabel} value={destinationAddress} />
                        <PaymentInfoRow
                            label="Exchange Rate"
                            value={`1 USD = ${priceLock?.price ?? currencyPrice!.sell} ${currencyCode!.toUpperCase()}`}
                            moreInfoText="Rate shown is current but may vary slightly (~$1-5 ARS) until payment is confirmed."
                        />
                        <PaymentInfoRow label="Peanut fee" value="Sponsored by Peanut!" hideBottomBorder />
                    </Card>

                    <Button
                        icon="arrow-up"
                        onClick={handleWithdraw}
                        loading={isLoading}
                        disabled={!!errorMessage || isLoading}
                        shadowSize="4"
                    >
                        {isLoading ? loadingState : 'Withdraw'}
                    </Button>
                    {(errorMessage || sumsubFlow.error) && (
                        <ErrorAlert description={(errorMessage || sumsubFlow.error)!} />
                    )}
                </div>
            )}
        </div>
    )
}
