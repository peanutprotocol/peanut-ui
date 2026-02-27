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
import { type BridgeKycStatus } from '@/utils/bridge-accounts.utils'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/context/authContext'
import { useCreateOnramp } from '@/hooks/useCreateOnramp'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import countryCurrencyMappings, { isNonEuroSepaCountry, isUKCountry } from '@/constants/countryCurrencyMapping'
import { formatUnits } from 'viem'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { getCurrencyConfig, getCurrencySymbol, getMinimumAmount } from '@/utils/bridge.utils'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import InfoCard from '@/components/Global/InfoCard'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'

// Step type for URL state
type BridgeBankStep = 'inputAmount' | 'showDetails'

export default function OnrampBankPage() {
    const router = useRouter()
    const params = useParams()

    // URL state - persisted in query params
    // Example: /add-money/mexico/bank?step=inputAmount&amount=500
    const [urlState, setUrlState] = useQueryStates(
        {
            step: parseAsStringEnum<BridgeBankStep>(['inputAmount', 'showDetails']),
            amount: parseAsString,
        },
        { history: 'push' }
    )

    // Amount from URL
    const rawTokenAmount = urlState.amount ?? ''

    // Local UI state (not URL-appropriate - transient)
    const [showWarningModal, setShowWarningModal] = useState<boolean>(false)
    const [showKycModal, setShowKycModal] = useState<boolean>(false)
    const [isRiskAccepted, setIsRiskAccepted] = useState<boolean>(false)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(undefined)
    const { setError, error, setOnrampData, onrampData } = useOnrampFlow()

    const { balance } = useWallet()
    const { user, fetchUser } = useAuth()
    const { createOnramp, isLoading: isCreatingOnramp, error: onrampError } = useCreateOnramp()

    // inline sumsub kyc flow for bridge bank onramp
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('STANDARD')
    const sumsubFlow = useMultiPhaseKycFlow({
        onKycSuccess: () => {
            setUrlState({ step: 'inputAmount' })
        },
    })

    const selectedCountryPath = params.country as string

    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

    const nonEuroCurrency = countryCurrencyMappings.find(
        (currency) =>
            selectedCountryPath.toLowerCase() === currency.country.toLowerCase() ||
            currency.path?.toLowerCase() === selectedCountryPath.toLowerCase()
    )?.currencyCode

    // non-eur sepa countries that are currently experiencing issues
    const isNonEuroSepa = isNonEuroSepaCountry(nonEuroCurrency)

    // uk-specific check
    const isUK = isUKCountry(selectedCountryPath)

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as BridgeKycStatus)
        },
    })

    useEffect(() => {
        if (user?.user.bridgeKycStatus) {
            setLiveKycStatus(user.user.bridgeKycStatus as BridgeKycStatus)
        }
    }, [user?.user.bridgeKycStatus])

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
                setError({ showError: true, errorMessage: 'Please enter a valid number.' })
                return false
            }
            if (amount && amount < minimumAmount) {
                setError({ showError: true, errorMessage: `Minimum deposit is ${minimumAmount}.` })
                return false
            }
            setError({ showError: false, errorMessage: '' })
            return true
        },
        [setError, minimumAmount]
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

        const currentKycStatus = liveKycStatus || user?.user.bridgeKycStatus
        const isUserKycVerified = currentKycStatus === 'approved'

        if (!isUserKycVerified) {
            setShowKycModal(true)
            return
        }

        setShowWarningModal(true)
    }

    const handleWarningConfirm = async () => {
        if (!selectedCountry) {
            setError({
                showError: true,
                errorMessage: 'Please select a country first.',
            })
            return
        }
        setShowWarningModal(false)
        setIsRiskAccepted(false)
        try {
            const onrampDataResponse = await createOnramp({
                amount: rawTokenAmount,
                country: selectedCountry,
            })
            setOnrampData(onrampDataResponse)

            if (onrampDataResponse.transferId) {
                setUrlState({ step: 'showDetails' })
            } else {
                setError({
                    showError: true,
                    errorMessage: 'Could not get onramp details. Please try again.',
                })
            }
        } catch (error) {
            setShowWarningModal(false)
            if (onrampError) {
                setError({
                    showError: true,
                    errorMessage: onrampError,
                })
            }
        }
    }

    const handleWarningCancel = () => {
        setShowWarningModal(false)
        setIsRiskAccepted(false)
    }

    const handleBack = () => {
        if (selectedCountry) {
            router.push(`/add-money/${selectedCountry.path}`)
        } else {
            router.push('/add-money')
        }
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
                <NavHeader title="Not Found" onPrev={() => router.back()} />
                <EmptyState title="Country not found" description="Please try a different country." icon="search" />
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
        return <AddMoneyBankDetails />
    }

    if (urlState.step === 'inputAmount') {
        const showLimitsCard = limitsValidation.isBlocking || limitsValidation.isWarning

        return (
            <div className="flex flex-col justify-start space-y-8">
                <NavHeader title="Add Money" onPrev={handleBack} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">How much do you want to add?</div>
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
                        <InfoCard
                            variant="warning"
                            icon="alert"
                            description="Amount must match what you send from your bank!"
                        />
                    )}

                    {/* Warning for non-EUR SEPA countries */}
                    {!limitsValidation.isBlocking && isNonEuroSepa && (
                        <InfoCard
                            variant="info"
                            icon="info"
                            title="EUR accounts only"
                            description={
                                isUK
                                    ? 'Only EUR accounts with IBAN work for onramps. Standard GBP accounts with Account Number + Sort Code are not supported.'
                                    : 'Only EUR accounts with IBAN work for onramps. Your local currency account may not work.'
                            }
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
                        Continue
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
                    onClose={() => setShowKycModal(false)}
                    onVerify={async () => {
                        setShowKycModal(false)
                        await sumsubFlow.handleInitiateKyc('STANDARD')
                    }}
                    isLoading={sumsubFlow.isLoading}
                />

                <SumsubKycModals flow={sumsubFlow} autoStartSdk />
            </div>
        )
    }

    return null
}
