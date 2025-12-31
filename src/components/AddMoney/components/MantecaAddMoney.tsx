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
import { MAX_MANTECA_DEPOSIT_AMOUNT, MIN_MANTECA_DEPOSIT_AMOUNT } from '@/constants/payment.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'

// Step type for URL state
type MantecaStep = 'inputAmount' | 'depositDetails'

// Currency denomination type for URL state
type CurrencyDenomination = 'USD' | 'ARS' | 'BRL' | 'MXN' | 'EUR'

interface MantecaAddMoneyProps {
    source: 'bank' | 'regionalMethod'
}

const MantecaAddMoney: FC<MantecaAddMoneyProps> = ({ source }) => {
    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()

    // URL state - persisted in query params
    // Example: /add-money/argentina/manteca?step=inputAmount&amount=100&currency=USD
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
    const usdAmount = urlState.amount ?? ''
    const currentDenomination = urlState.currency ?? 'USD'

    // Local UI state (not URL-appropriate - transient or API responses)
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>()
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

    // Validate amount when it changes
    useEffect(() => {
        if (!usdAmount || usdAmount === '0.00') {
            setError(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount < parseUnits(MIN_MANTECA_DEPOSIT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount must be at least $${MIN_MANTECA_DEPOSIT_AMOUNT}`)
        } else if (paymentAmount > parseUnits(MAX_MANTECA_DEPOSIT_AMOUNT.toString(), PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount exceeds maximum limit of $${MAX_MANTECA_DEPOSIT_AMOUNT}`)
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

    // Handle amount change - sync to URL state
    const handleAmountChange = useCallback(
        (value: string) => {
            setUrlState({ amount: value || null }) // null removes from URL
        },
        [setUrlState]
    )

    // Handle currency denomination change - sync to URL state
    const handleDenominationChange = useCallback(
        (value: string) => {
            // Only persist valid currency denominations to URL
            const validCurrencies: CurrencyDenomination[] = ['USD', 'ARS', 'BRL', 'MXN', 'EUR']
            if (validCurrencies.includes(value as CurrencyDenomination)) {
                setUrlState({ currency: value as CurrencyDenomination })
            }
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
            const amount = isUsdDenominated ? usdAmount : currencyAmount
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
        usdAmount,
        currencyAmount,
        isMantecaKycRequired,
        isCreatingDeposit,
        setUrlState,
    ])

    // handle verification modal opening
    useEffect(() => {
        if (isMantecaKycRequired) {
            setIsKycModalOpen(true)
        }
    }, [isMantecaKycRequired])

    if (!selectedCountry) return null

    if (step === 'inputAmount') {
        return (
            <>
                <InputAmountStep
                    tokenAmount={usdAmount}
                    setTokenAmount={handleAmountChange}
                    onSubmit={handleAmountSubmit}
                    isLoading={isCreatingDeposit}
                    error={error}
                    currencyData={currencyData}
                    setCurrencyAmount={setCurrencyAmount}
                    setCurrentDenomination={handleDenominationChange}
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

    if (step === 'depositDetails' && depositDetails) {
        return (
            <MantecaDepositShareDetails
                source={source}
                depositDetails={depositDetails}
                currencyAmount={currencyAmount}
            />
        )
    }

    return null
}

export default MantecaAddMoney
