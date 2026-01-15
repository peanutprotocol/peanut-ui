'use client'
import { type FC, useEffect, useMemo, useState, useCallback } from 'react'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import InputAmountStep from '@/components/AddMoney/components/InputAmountStep'
import { useParams, useRouter } from 'next/navigation'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { mantecaApi } from '@/services/manteca'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import useKycStatus from '@/hooks/useKycStatus'
import { MIN_MANTECA_DEPOSIT_AMOUNT } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import { mapToLimitCurrency } from '@/features/limits/utils/limits.utils'

// Step type for URL state
type MantecaStep = 'inputAmount' | 'depositDetails'

// Currency denomination type for URL state
type CurrencyDenomination = 'USD' | 'ARS' | 'BRL' | 'MXN' | 'EUR'

const MantecaAddMoney: FC = () => {
    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()

    // URL state - persisted in query params
    // Example: /add-money/argentina/manteca?step=inputAmount&amount=100&currency=ARS
    // The `amount` is stored in whatever denomination `currency` specifies
    const [urlState, setUrlState] = useQueryStates(
        {
            step: parseAsStringEnum<MantecaStep>(['inputAmount', 'depositDetails']),
            amount: parseAsString,
            currency: parseAsStringEnum<CurrencyDenomination>(['USD', 'ARS', 'BRL', 'MXN', 'EUR']),
        },
        { history: 'push' }
    )

    // Derive state from URL (with defaults)
    const step: MantecaStep = urlState.step ?? 'inputAmount'
    // Amount from URL - this is in the denomination specified by `currency`
    const displayedAmount = urlState.amount ?? ''
    const currentDenomination = urlState.currency ?? 'USD'

    // Local UI state for tracking both amounts (needed for API call and validation)
    const [usdAmount, setUsdAmount] = useState<string>('')
    const [localCurrencyAmount, setLocalCurrencyAmount] = useState<string>('')

    // Other local UI state (not URL-appropriate - transient or API responses)
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [depositDetails, setDepositDetails] = useState<MantecaDepositResponseData>()
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)

    const selectedCountryPath = params.country as string
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])
    const { isMantecaKycRequired } = useMantecaKycFlow({ country: selectedCountry as CountryData })
    const { isUserBridgeKycApproved } = useKycStatus()
    const currencyData = useCurrency(selectedCountry?.currency ?? 'ARS')
    const { user, fetchUser } = useAuth()

    // determine currency for limits validation
    const limitsCurrency = useMemo(() => {
        return mapToLimitCurrency(selectedCountry?.currency)
    }, [selectedCountry?.currency])

    // validate against user's limits
    const limitsValidation = useLimitsValidation({
        flowType: 'onramp',
        amount: usdAmount,
        currency: limitsCurrency,
        isLocalUser: true, // manteca is for local users
    })

    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onMantecaKycStatusUpdate: (newStatus) => {
            // listen for manteca kyc status updates, either when the user is approved or when the widget is finished to continue with the flow
            if (newStatus === 'ACTIVE' || newStatus === 'WIDGET_FINISHED') {
                fetchUser()
                setIsKycModalOpen(false)
            }
        },
    })

    // Validate USD amount (min check only - max is handled by limits validation)
    useEffect(() => {
        if (!usdAmount || usdAmount === '0.00') {
            setError(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount < parseUnits(MIN_MANTECA_DEPOSIT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount must be at least $${MIN_MANTECA_DEPOSIT_AMOUNT}`)
        } else {
            setError(null)
        }
    }, [usdAmount])

    // Invalidate transactions query when entering deposit details step
    useEffect(() => {
        if (step === 'depositDetails') {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [step, queryClient])

    const handleKycCancel = () => {
        setIsKycModalOpen(false)
        if (selectedCountry?.path) {
            router.push(`/add-money/${selectedCountry.path}`)
        }
    }

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

    // Handle currency denomination change - sync to URL state
    const handleDenominationChange = useCallback(
        (value: string) => {
            setUrlState({ currency: value as CurrencyDenomination })
        },
        [setUrlState]
    )

    const handleAmountSubmit = useCallback(async () => {
        if (!selectedCountry?.currency) return
        if (isCreatingDeposit) return

        // check if we still need to determine KYC status
        if (isMantecaKycRequired === null) {
            // still loading/determining KYC status, don't proceed yet
            return
        }

        if (isMantecaKycRequired === true) {
            setIsKycModalOpen(true)
            return
        }

        try {
            setError(null)
            setIsCreatingDeposit(true)
            const isUsdDenominated = currentDenomination === 'USD'
            // Use the displayed amount for the API call
            const amount = displayedAmount
            const depositData = await mantecaApi.deposit({
                amount: amount!,
                isUsdDenominated,
                currency: selectedCountry.currency,
            })
            if (depositData.error) {
                setError(depositData.error)
                return
            }
            setDepositDetails(depositData.data)
            // Update URL state to show deposit details step
            setUrlState({ step: 'depositDetails' })
        } catch (error) {
            console.log(error)
            setError(error instanceof Error ? error.message : String(error))
        } finally {
            setIsCreatingDeposit(false)
        }
    }, [currentDenomination, selectedCountry, displayedAmount, isMantecaKycRequired, isCreatingDeposit, setUrlState])

    // handle verification modal opening
    useEffect(() => {
        if (isMantecaKycRequired) {
            setIsKycModalOpen(true)
        }
    }, [isMantecaKycRequired])

    // Redirect to inputAmount if depositDetails is accessed without required data (deep link / back navigation)
    useEffect(() => {
        if (step === 'depositDetails' && !depositDetails) {
            setUrlState({ step: 'inputAmount' })
        }
    }, [step, depositDetails, setUrlState])

    if (!selectedCountry) return null

    if (step === 'inputAmount') {
        return (
            <>
                <InputAmountStep
                    tokenAmount={displayedAmount}
                    setTokenAmount={handleUsdAmountChange}
                    onSubmit={handleAmountSubmit}
                    isLoading={isCreatingDeposit}
                    error={error}
                    currencyData={currencyData}
                    setCurrencyAmount={handleLocalCurrencyAmountChange}
                    setCurrentDenomination={handleDenominationChange}
                    initialDenomination={currentDenomination}
                    setDisplayedAmount={handleDisplayedAmountChange}
                    limitsValidation={limitsValidation}
                    limitsCurrency={limitsCurrency}
                />
                {isKycModalOpen && (
                    <MantecaGeoSpecificKycModal
                        isUserBridgeKycApproved={isUserBridgeKycApproved}
                        isMantecaModalOpen={isKycModalOpen}
                        setIsMantecaModalOpen={setIsKycModalOpen}
                        onClose={handleKycCancel}
                        onManualClose={handleKycCancel}
                        onKycSuccess={() => {
                            // close the modal and let the user continue with amount input
                            setIsKycModalOpen(false)
                            fetchUser()
                        }}
                        selectedCountry={selectedCountry}
                    />
                )}
            </>
        )
    }

    if (step === 'depositDetails') {
        // Show nothing while useEffect redirects if data is missing
        if (!depositDetails) {
            return null
        }
        return <MantecaDepositShareDetails depositDetails={depositDetails} currencyAmount={localCurrencyAmount} />
    }

    return null
}

export default MantecaAddMoney
