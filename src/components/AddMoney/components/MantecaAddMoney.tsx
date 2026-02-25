'use client'
import { type FC, useEffect, useMemo, useState, useCallback } from 'react'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import InputAmountStep from '@/components/AddMoney/components/InputAmountStep'
import { useParams } from 'next/navigation'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuth } from '@/context/authContext'
import { mantecaApi } from '@/services/manteca'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import useKycStatus from '@/hooks/useKycStatus'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { MIN_MANTECA_DEPOSIT_AMOUNT } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'

// Step type for URL state
type MantecaStep = 'inputAmount' | 'depositDetails'

// Currency denomination type for URL state
type CurrencyDenomination = 'USD' | 'ARS' | 'BRL' | 'MXN' | 'EUR'

const MantecaAddMoney: FC = () => {
    const params = useParams()
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

    const selectedCountryPath = params.country as string
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])
    const { isUserMantecaKycApproved } = useKycStatus()
    const currencyData = useCurrency(selectedCountry?.currency ?? 'ARS')
    const { user } = useAuth()

    // inline sumsub kyc flow for manteca users who need LATAM verification
    const sumsubFlow = useMultiPhaseKycFlow({
        regionIntent: 'LATAM',
    })

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
            setError(null)
            return
        }

        // user has entered something - validate the USD equivalent
        // if USD amount is effectively zero or too small, show minimum error
        if (!usdAmount || usdAmount === '0.00') {
            setError(`Deposit amount must be at least $${MIN_MANTECA_DEPOSIT_AMOUNT}`)
            return
        }

        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount < parseUnits(MIN_MANTECA_DEPOSIT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount must be at least $${MIN_MANTECA_DEPOSIT_AMOUNT}`)
        } else {
            setError(null)
        }
    }, [usdAmount, displayedAmount])

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

        if (!isUserMantecaKycApproved) {
            await sumsubFlow.handleInitiateKyc()
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
    }, [
        currentDenomination,
        selectedCountry,
        displayedAmount,
        isUserMantecaKycApproved,
        isCreatingDeposit,
        setUrlState,
        sumsubFlow.handleInitiateKyc,
    ])

    // auto-start KYC if user hasn't completed manteca verification
    useEffect(() => {
        if (!isUserMantecaKycApproved) {
            sumsubFlow.handleInitiateKyc()
        }
    }, [isUserMantecaKycApproved]) // eslint-disable-line react-hooks/exhaustive-deps

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
                <SumsubKycModals flow={sumsubFlow} />
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
                    limitsCurrency={limitsValidation.currency}
                />
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
