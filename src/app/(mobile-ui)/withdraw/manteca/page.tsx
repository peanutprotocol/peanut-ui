'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { useStaleSessionGuard } from '@/hooks/wallet/useStaleSessionGuard'
import { SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { friendlyError } from '@/utils/friendly-error.utils'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { rainCentsToUsdcUnits, isAmountWithinBalance } from '@/utils/balance.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useState, useMemo, useContext, useEffect, useCallback, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import NavHeader from '@/components/Global/NavHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import RateGateScreen from '@/components/Global/RateUnavailable/RateGateScreen'
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
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useQueryClient } from '@tanstack/react-query'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
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
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { MantecaTransfersMaintenanceView } from '@/components/Global/Banner/MantecaTransfersMaintenanceView'
import { useLocale, useTranslations } from 'next-intl'
import { localizedCountryTitle } from '@/utils/country-name.utils'
import { loadingStateKey } from '@/i18n/app/loading-states'

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
    // Manteca provider outage — block the offramp only for currencies still
    // down. Placed AFTER the Brazil-PIX delegation so PIX-over-QR sends (which
    // ride the QR-payment endpoint, not Manteca offramp) stay open.
    const withdrawCurrency = countryData.find((c) => c.path === searchParams.get('country'))?.currency?.toUpperCase()
    if (withdrawCurrency && (underMaintenanceConfig.disabledMantecaCurrencies as string[]).includes(withdrawCurrency)) {
        return <MantecaTransfersMaintenanceView action="withdrawals" />
    }
    return <MantecaBankWithdrawFlow />
}

function MantecaBankWithdrawFlow() {
    const locale = useLocale()
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const tErrors = useTranslations('errors')
    const toFriendlyError = useFriendlyError()
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
    // client-side destination/bank-details validation renders as the field's
    // own error under the inputs; errorMessage keeps flow failures (rate lock,
    // provider, signing) in the Notification
    const [fieldError, setFieldError] = useState<string | null>(null)
    const [errorMessage, setErrorMessageRaw] = useState<string | null>(null)
    // Companion code for `errorMessage` so the retry-vs-block gate compares a
    // stable identifier, never the localized string. Every set clears it unless
    // a code is passed explicitly.
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const setErrorMessage = useCallback((message: string | null, errCode: string | null = null) => {
        setErrorMessageRaw(message)
        setErrorCode(errCode)
    }, [])
    const [isDestinationAddressValid, setIsDestinationAddressValid] = useState(false)
    const [isDestinationAddressChanging, setIsDestinationAddressChanging] = useState(false)
    // price lock state - holds the locked price from /withdraw/init
    const [priceLock, setPriceLock] = useState<WithdrawPriceLock | null>(null)
    const [isLockingPrice, setIsLockingPrice] = useState(false)
    const router = useRouter()
    const { spendableBalance: balance, formattedSpendableBalance } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const handleStaleSession = useStaleSessionGuard()
    const { overview: rainCardOverview } = useRainCardOverview()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const { setIsSupportModalOpen, openSupportWithMessage } = useModalsContext()
    const queryClient = useQueryClient()
    // The pool→full upgrade gate reads identityVerification (Sumsub-cleared
    // the human), not rail-approval. Same fix-pattern as Profile/ProfileEdit.
    const { rails, nextActions } = useCapabilities()
    const { isVerified: isUserIdentityVerified } = useIdentityVerification()
    const mantecaRejection = useMemo(() => deriveProviderRejection(rails, 'MANTECA', nextActions), [rails, nextActions])
    const { hasPendingTransactions } = usePendingTransactions()

    // inline sumsub kyc flow for manteca users who need LATAM verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('LATAM')
    const sumsubFlow = useMultiPhaseKycFlow({})
    const [showKycModal, setShowKycModal] = useState(false)

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
        refetch: refetchCurrency,
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
        onNeedsSupport: () => openSupportWithMessage(t('manteca.increaseLimitsMessage')),
    })

    // Get country flag code
    const countryFlagCode = useMemo(() => {
        return selectedCountry?.iso2?.toLowerCase()
    }, [selectedCountry])

    // Get method display info
    const methodDisplayInfo = useMemo(() => {
        const methodNames: { [key: string]: string } = {
            mercadopago: t('methods.mercadopago'),
            pix: t('methods.pix'),
            'bank-transfer': t('methods.bankTransfer'),
        }

        return {
            name: methodNames[selectedMethodType || 'bank-transfer'] || t('methods.bankTransfer'),
        }
    }, [selectedMethodType, t])

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
                    setFieldError(argResult.message!)
                }
                break
            case 'brazil':
                value = isPixEmvcoQr(value.trim()) ? value.trim() : value.replace(/\s/g, '')
                const pixResult = validatePixKey(value)
                isValid = pixResult.valid
                if (!pixResult.valid) {
                    setFieldError(pixResult.message!)
                }
                break
            default:
                isValid = true
                break
        }

        return isValid
    }

    /**
     * Detect Manteca onboarding-incomplete errors and surface an actionable
     * message. Returns true if the error was handled (caller should return early).
     *
     * This used to redirect into the Manteca hosted onboarding widget — a
     * KYC-2.0-era dead end (Sumsub owns data collection; `submitToManteca` in
     * peanut-api-ts owns submission) with 0 triggers in 90 days. The widget
     * redirect and its `/manteca/initiate-onboarding` backend route are gone.
     */
    const handleOnboardingError = useCallback(
        (error: string): boolean => {
            // 'manteca kyc' / 'manteca_kyc_required' cover the API's
            // MANTECA_KYC_REQUIRED responses ("User needs to do manteca KYC
            // first") — the service layer strips the `code` field, so the text
            // is all this screen ever sees.
            const onboardingErrorPatterns = [
                'fund origin',
                'profile incomplete',
                'onboarding required',
                'manteca kyc',
                'manteca_kyc_required',
            ]
            const normalizedError = error.toLowerCase()
            const isOnboardingError = onboardingErrorPatterns.some((pattern) => normalizedError.includes(pattern))
            if (!isOnboardingError) return false

            setErrorMessage(t('errors.completeAccountSetup'))
            return true
        },
        [t]
    )

    const isCompleteBankDetails = useMemo<boolean>(() => {
        return (
            !!destinationAddress.trim() &&
            (!countryConfig?.needsBankCode || selectedBank != null) &&
            (!countryConfig?.needsAccountType || accountType != null)
        )
    }, [selectedBank, accountType, countryConfig, destinationAddress, setErrorMessage])

    const handleBankDetailsSubmit = useCallback(async () => {
        // prevent duplicate requests from rapid clicks
        if (isLockingPrice) return

        if (!destinationAddress.trim()) {
            setFieldError(t('errors.enterAccountAddress'))
            return
        }
        if ((countryConfig?.needsBankCode && !selectedBank) || (countryConfig?.needsAccountType && !accountType)) {
            setFieldError(t('errors.completeBankDetails'))
            return
        }
        setFieldError(null)
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
                if (handleOnboardingError(result.error)) return
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
            void captureNetworkTriagedFailure(error, {
                tags: { ...criticalFlowTags('withdraw-manteca'), withdraw_step: 'lock-rate' },
            })
            setErrorMessage(t('errors.lockRateFailed'))
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
        t,
        setErrorMessage,
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
                // Route through the shared classifier so backend wire codes reach
                // this screen too; the branches ahead of it are per-flow.
                const classified = friendlyError(error)
                if (error instanceof SessionKeyGrantRequiredError) {
                    // Grant prompt was attempted inside signSpend and failed.
                    // Telling the user "you'll be asked" is misleading — they
                    // may retry and hit the same loop. Give an actionable hint.
                    setErrorMessage(t('errors.cardAuthFailed'))
                } else if ((error as Error).toString().includes('not allowed')) {
                    setErrorMessage(t('errors.confirmTransaction'))
                } else if (classified.kind === 'code' && classified.code === 'genericSupport') {
                    // Keep the flow-specific fallback and the Sentry report.
                    void captureNetworkTriagedFailure(error, {
                        tags: { ...criticalFlowTags('withdraw-manteca'), withdraw_step: 'sign' },
                    })
                    setErrorMessage(t('errors.signFailed'))
                } else {
                    // A classified error is normally a deliberate non-report
                    // (backend wire code, or a user action). Network-layer
                    // failures are the exception: once `connectionLost` existed
                    // they classified HERE instead of genericSupport above, which
                    // silently ended their Sentry reporting (TASK-21956).
                    if (isNetworkLayerFailure(error)) {
                        void captureNetworkTriagedFailure(error, {
                            tags: { ...criticalFlowTags('withdraw-manteca'), withdraw_step: 'sign' },
                        })
                    }
                    setErrorMessage(toFriendlyError(error), classified.kind === 'text' ? null : classified.code)
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
                if (handleOnboardingError(result.message ?? result.error)) return

                // handle third-party account error with user-friendly message
                if (result.error === 'TAX_ID_MISMATCH' || result.error === 'CUIT_MISMATCH') {
                    setErrorMessage(t('errors.ownAccountOnly'))
                } else if (result.error === 'Unexpected error') {
                    setErrorMessage(t('errors.unexpected'))
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
            // Reported here rather than left to the console-capture integration,
            // which the noise filters then drop: the money leg of an offramp
            // dying was leaving no queryable Sentry record at all (TASK-21956).
            void captureNetworkTriagedFailure(error, {
                tags: { ...criticalFlowTags('withdraw-manteca'), withdraw_step: 'submit' },
                extra: { amountUsd: usdAmount, country: countryPath },
                analytics: {
                    event: ANALYTICS_EVENTS.WITHDRAW_FAILED,
                    props: {
                        method_type: 'manteca',
                        error_message: 'Withdraw failed unexpectedly',
                        error_name: error instanceof Error ? error.name : 'unknown',
                        error_raw: error instanceof Error ? error.message : String(error),
                    },
                },
            })
            setErrorMessage(t('errors.unexpected'))
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
        setFieldError(null)
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
            setBalanceErrorMessage(t('errors.minWithdrawAmount', { amount: MIN_MANTECA_WITHDRAW_AMOUNT }))
        } else if (!isAmountWithinBalance(usdAmount, balance)) {
            // gate on the displayed total; an in-transit shortfall passes here and
            // fails late with the settling message at execution.
            setBalanceErrorMessage(tErrors('notEnoughBalanceAddFunds'))
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance, hasPendingTransactions, isLoading, t, tErrors])

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

    // Rate gate keeps the header mounted so back always works (dev #2843/#1848)
    if (selectedCountry && countryConfig && (isCurrencyLoading || !currencyPrice)) {
        return (
            <RateGateScreen
                title={tNav('withdraw')}
                onBack={onBack}
                isLoading={isCurrencyLoading}
                onRetry={refetchCurrency}
            />
        )
    }

    if (!selectedCountry || !countryConfig) {
        return <Loading variant="mascot" />
    }

    if (step === 'success') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <SoundPlayer sound="success" />
                <NavHeader title={tNav('withdraw')} />
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <IconBubble icon="check" color="green" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-body-s font-normal text-foreground-secondary">
                                {t('manteca.youJustWithdrew')}
                            </h1>
                            <div className="text-heading-s text-foreground-primary">
                                {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                            </div>
                            <div className="text-heading-card text-foreground-primary">
                                ≈ ${formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                            </div>
                            <h1 className="text-body-s font-normal text-foreground-secondary">
                                {t('manteca.toDestination', { destination: destinationAddress })}
                            </h1>
                        </div>
                    </Card>

                    {/* Points Display - ref used for confetti origin point */}
                    {pointsData?.estimatedPoints && (
                        <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                    )}

                    <div className="space-y-4 w-full">
                        <Button
                            onClick={() => {
                                router.push('/home')
                                resetState()
                            }}
                            shadowSize="4"
                        >
                            {t('backToHome')}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'failure') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title={tNav('withdraw')} />
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    <Card className="shadow-4">
                        <Card.Header>
                            <Card.Title>{t('somethingWentWrong')}</Card.Title>
                            <Card.Description>{errorMessage}</Card.Description>
                        </Card.Header>
                        <Card.Content className="flex flex-col gap-3">
                            <Button onClick={resetState} variant="purple">
                                {tCommon('tryAgain')}
                            </Button>
                            <LinkButton onClick={() => setIsSupportModalOpen(true)} className="self-center">
                                {tCommon('contactSupport')}
                            </LinkButton>
                        </Card.Content>
                    </Card>
                </div>
            </div>
        )
    }
    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <InitiateKycModal
                prepPath="extended"
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
                        await sumsubFlow.handleFixableRejection(mantecaRejection)
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
                reasonCode={mantecaRejection.reasonCode ?? undefined}
                regionName={selectedCountry && localizedCountryTitle(locale, selectedCountry)}
            />
            <SumsubKycModals flow={sumsubFlow} />
            <SumsubKycWrapper
                visible={limitIncreaseFlow.showWrapper}
                accessToken={limitIncreaseFlow.accessToken}
                onClose={limitIncreaseFlow.handleClose}
                onComplete={limitIncreaseFlow.handleSdkComplete}
                onRefreshToken={limitIncreaseFlow.refreshToken}
                isMultiLevel
            />
            <NavHeader
                title={tNav('withdraw')}
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
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    <div className="text-heading-xs text-foreground-primary">{t('amountToWithdraw')}</div>
                    {/* only show the balance error if limits blocking card is not displayed (warnings can coexist) */}
                    <FieldColumn error={!limitsValidation.isBlocking ? balanceErrorMessage : undefined}>
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
                    </FieldColumn>

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
                        {tCommon('continue')}
                    </Button>
                </div>
            )}

            {step === 'bankDetails' && (
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    {/* Amount Display Card */}
                    <Card className="p-4">
                        <div className="space-x-3 flex items-center">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={getFlagUrl(countryFlagCode)}
                                    alt={t('manteca.flagAlt')}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                                <IconBubble
                                    icon="bank"
                                    size="xs"
                                    color="blue"
                                    className="absolute -right-1 -bottom-1"
                                />
                            </div>
                            <div>
                                <p className="flex items-center gap-1 text-center text-body-s text-foreground-secondary">
                                    <Icon name="arrow-up" size={10} /> {t('manteca.youreWithdrawing')}
                                </p>
                                <p className="text-heading-s text-foreground-primary">
                                    {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                                </p>
                                <div className="text-heading-card text-foreground-primary">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Bank Details Form */}
                    <div className="space-y-4">
                        <h2 className="text-heading-card text-foreground-primary">
                            {t('manteca.enterMethodDetails', { method: methodDisplayInfo.name })}
                        </h2>
                        <div className="space-y-2">
                            <FieldColumn error={fieldError}>
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
                                            setFieldError(null)
                                            setErrorMessage(null)
                                        }
                                    }}
                                    validate={validateDestinationAddress}
                                />
                            </FieldColumn>
                            {countryConfig?.needsAccountType && (
                                <BaseSelect
                                    value={accountType ?? undefined}
                                    onValueChange={(value) => {
                                        setAccountType(MantecaAccountType[value as keyof typeof MantecaAccountType])
                                    }}
                                    options={countryConfig.validAccountTypes.map((type) => ({
                                        label: type,
                                        value: type,
                                    }))}
                                    placeholder={t('manteca.selectAccountType')}
                                />
                            )}
                            {countryConfig?.needsBankCode && (
                                <BaseSelect
                                    value={selectedBank?.code}
                                    onValueChange={(value) => {
                                        const bank = countryConfig.validBankCodes.find((b) => b.code === value)
                                        if (bank) setSelectedBank({ code: bank.code, name: bank.name })
                                    }}
                                    options={countryConfig.validBankCodes.map((bank) => ({
                                        label: bank.name,
                                        value: bank.code,
                                    }))}
                                    placeholder={t('manteca.selectBank')}
                                />
                            )}

                            <div className="flex items-center gap-2 text-body-s text-foreground-secondary">
                                <Icon name="info" size={16} />
                                <span>{t('manteca.ownAccountOnly')}</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleBankDetailsSubmit}
                            disabled={
                                !isCompleteBankDetails ||
                                isDestinationAddressChanging ||
                                !isDestinationAddressValid ||
                                isLockingPrice
                            }
                            loading={isDestinationAddressChanging || isLockingPrice}
                            className="w-full"
                            shadowSize="4"
                        >
                            {isLockingPrice ? t('manteca.lockingRate') : t('review')}
                        </Button>

                        {(errorMessage || sumsubFlow.error) && (
                            <Notification priority="error">{(errorMessage || sumsubFlow.error)!}</Notification>
                        )}
                    </div>
                </div>
            )}

            {step === 'review' && (
                <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                    <Card className="p-4">
                        <div className="space-x-3 flex items-center">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={getFlagUrl(countryFlagCode)}
                                    alt={t('manteca.flagAlt')}
                                    width={48}
                                    height={48}
                                    className="h-12 w-12 rounded-full object-cover"
                                />
                                <IconBubble
                                    icon="bank"
                                    size="xs"
                                    color="blue"
                                    className="absolute -right-1 -bottom-1"
                                />
                            </div>
                            <div>
                                <p className="flex items-center gap-1 text-center text-body-s text-foreground-secondary">
                                    <Icon name="arrow-up" size={10} /> {t('manteca.youreWithdrawing')}
                                </p>
                                <p className="text-heading-s text-foreground-primary">
                                    {currencyCode}{' '}
                                    {formatNumberForDisplay(priceLock?.fiatAmount ?? currencyAmount, {
                                        maxDecimals: 2,
                                    })}
                                </p>
                                <div className="text-heading-card text-foreground-primary">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>
                    {/* Review Summary */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow label={countryConfig!.accountNumberLabel} value={destinationAddress} />
                        <PaymentInfoRow
                            label={t('manteca.exchangeRate')}
                            value={`1 USD = ${priceLock?.price ?? currencyPrice!.sell} ${currencyCode!.toUpperCase()}`}
                            moreInfoText={t('manteca.exchangeRateInfo')}
                        />
                        <PaymentInfoRow
                            label={tCommon('peanutFee')}
                            value={tCommon('sponsoredByPeanut')}
                            hideBottomBorder
                        />
                    </Card>

                    <Button
                        icon="arrow-up"
                        onClick={handleWithdraw}
                        loading={isLoading}
                        // settling failure is retryable — don't dead-end the button on it
                        disabled={(!!errorMessage && errorCode !== 'balanceSettling') || isLoading}
                        shadowSize="4"
                    >
                        {isLoading ? tLoading(loadingStateKey(loadingState)) : tNav('withdraw')}
                    </Button>
                    {(errorMessage || sumsubFlow.error) && (
                        <Notification priority="error">{(errorMessage || sumsubFlow.error)!}</Notification>
                    )}
                </div>
            )}
        </div>
    )
}
