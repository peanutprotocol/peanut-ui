'use client'
import { type FC, useEffect, useMemo, useState } from 'react'
import MantecaDepositShareDetails from '@/components/AddMoney/components/MantecaDepositShareDetails'
import InputAmountStep from '@/components/AddMoney/components/InputAmountStep'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { mantecaApi } from '@/services/manteca'
import { PEANUT_WALLET_TOKEN_DECIMALS, TRANSACTIONS } from '@/constants'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import useKycStatus from '@/hooks/useKycStatus'
import { usePaymentStore } from '@/redux/hooks'
import { saveDevConnectIntent } from '@/utils'

interface MantecaAddMoneyProps {
    source: 'bank' | 'regionalMethod'
}

type stepType = 'inputAmount' | 'depositDetails'

const MAX_DEPOSIT_AMOUNT = '2000'
const MIN_DEPOSIT_AMOUNT = '1'

const MantecaAddMoney: FC<MantecaAddMoneyProps> = ({ source }) => {
    const params = useParams()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<stepType>('inputAmount')
    const [isCreatingDeposit, setIsCreatingDeposit] = useState(false)
    const [tokenAmount, setTokenAmount] = useState('')
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>()
    const [usdAmount, setUsdAmount] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [depositDetails, setDepositDetails] = useState<MantecaDepositResponseData>()
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const queryClient = useQueryClient()
    const { parsedPaymentData } = usePaymentStore()

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

    useEffect(() => {
        if (!usdAmount || usdAmount === '0.00') {
            setError(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount.replace(/,/g, ''), PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount < parseUnits(MIN_DEPOSIT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount must be at least $${MIN_DEPOSIT_AMOUNT}`)
        } else if (paymentAmount > parseUnits(MAX_DEPOSIT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setError(`Deposit amount exceeds maximum limit of $${MAX_DEPOSIT_AMOUNT}`)
        } else {
            setError(null)
        }
    }, [usdAmount])

    useEffect(() => {
        if (step === 'depositDetails') {
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
        }
    }, [step])

    const handleKycCancel = () => {
        setIsKycModalOpen(false)
        if (selectedCountry?.path) {
            router.push(`/add-money/${selectedCountry.path}`)
        }
    }

    const handleAmountSubmit = async () => {
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
            const depositData = await mantecaApi.deposit({
                usdAmount: usdAmount.replace(/,/g, ''),
                currency: selectedCountry.currency,
            })
            if (depositData.error) {
                setError(depositData.error)
                return
            }
            setDepositDetails(depositData.data)

            // @dev: save devconnect intent if this is a devconnect flow - to be deleted post devconnect
            saveDevConnectIntent(user?.user?.userId, parsedPaymentData, usdAmount, depositData.data?.externalId)

            setStep('depositDetails')
        } catch (error) {
            console.log(error)
            setError(error instanceof Error ? error.message : String(error))
        } finally {
            setIsCreatingDeposit(false)
        }
    }

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
                    tokenAmount={tokenAmount}
                    setTokenAmount={setTokenAmount}
                    onSubmit={handleAmountSubmit}
                    isLoading={isCreatingDeposit}
                    error={error}
                    setUsdAmount={setUsdAmount}
                    currencyData={currencyData}
                    setCurrencyAmount={setCurrencyAmount}
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
