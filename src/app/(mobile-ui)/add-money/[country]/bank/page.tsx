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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { UserDetailsForm, type UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import { updateUserById } from '@/app/actions/users'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { getCurrencyConfig, getCurrencySymbol, getMinimumAmount } from '@/utils/bridge.utils'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import { InitiateBridgeKYCModal } from '@/components/Kyc/InitiateBridgeKYCModal'
import InfoCard from '@/components/Global/InfoCard'
import { useQueryStates, parseAsString, parseAsStringEnum } from 'nuqs'

// Step type for URL state
type BridgeBankStep = 'inputAmount' | 'kyc' | 'collectUserDetails' | 'showDetails'

export default function OnrampBankPage() {
    const router = useRouter()
    const params = useParams()

    // URL state - persisted in query params
    // Example: /add-money/mexico/bank?step=inputAmount&amount=500
    const [urlState, setUrlState] = useQueryStates(
        {
            step: parseAsStringEnum<BridgeBankStep>(['inputAmount', 'kyc', 'collectUserDetails', 'showDetails']),
            amount: parseAsString,
        },
        { history: 'push' }
    )

    // Amount from URL
    const rawTokenAmount = urlState.amount ?? ''

    // Local UI state (not URL-appropriate - transient)
    const [showWarningModal, setShowWarningModal] = useState<boolean>(false)
    const [isRiskAccepted, setIsRiskAccepted] = useState<boolean>(false)
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<BridgeKycStatus | undefined>(undefined)
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)

    const { setError, error, setOnrampData, onrampData } = useOnrampFlow()
    const formRef = useRef<{ handleSubmit: () => void }>(null)

    const { balance } = useWallet()
    const { user, fetchUser } = useAuth()
    const { createOnramp, isLoading: isCreatingOnramp, error: onrampError } = useCreateOnramp()

    const selectedCountryPath = params.country as string

    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

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

    // Determine initial step based on KYC status (only when URL has no step)
    useEffect(() => {
        // If URL already has a step, respect it (allows deep linking)
        if (urlState.step) return

        // Wait for user to be fetched before determining initial step
        if (user === null) return

        const currentKycStatus = liveKycStatus || user?.user.bridgeKycStatus
        const isUserKycVerified = currentKycStatus === 'approved'

        if (!isUserKycVerified) {
            setUrlState({ step: 'collectUserDetails' })
        } else {
            setUrlState({ step: 'inputAmount' })
        }
    }, [liveKycStatus, user, urlState.step, setUrlState])

    // Handle KYC completion
    useEffect(() => {
        if (urlState.step === 'kyc' && liveKycStatus === 'approved') {
            setUrlState({ step: 'inputAmount' })
        }
    }, [liveKycStatus, urlState.step, setUrlState])

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
        if (validateAmount(rawTokenAmount)) {
            setShowWarningModal(true)
        }
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

    const handleKycSuccess = () => {
        setIsKycModalOpen(false)
        setUrlState({ step: 'inputAmount' })
    }

    const handleKycModalClose = () => {
        setIsKycModalOpen(false)
    }

    const handleUserDetailsSubmit = async (data: UserDetailsFormData) => {
        setIsUpdatingUser(true)
        setUserUpdateError(null)
        try {
            if (!user?.user.userId) throw new Error('User not found')
            const result = await updateUserById({
                userId: user.user.userId,
                fullName: data.fullName,
                email: data.email,
            })
            if (result.error) {
                throw new Error(result.error)
            }
            await fetchUser()
            setUrlState({ step: 'kyc' })
        } catch (error: any) {
            setUserUpdateError(error.message)
            return { error: error.message }
        } finally {
            setIsUpdatingUser(false)
        }
        return {}
    }

    const handleBack = () => {
        if (selectedCountry) {
            router.push(`/add-money/${selectedCountry.path}`)
        } else {
            router.push('/add-money')
        }
    }

    const initialUserDetails: Partial<UserDetailsFormData> = useMemo(
        () => ({
            fullName: user?.user.fullName ?? '',
            email: user?.user.email ?? '',
        }),
        [user?.user.fullName, user?.user.email]
    )

    useEffect(() => {
        if (urlState.step === 'kyc') {
            setIsKycModalOpen(true)
        }
    }, [urlState.step])

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

    if (urlState.step === 'collectUserDetails') {
        return (
            <div className="flex flex-col justify-start space-y-8">
                <NavHeader onPrev={handleBack} title="Identity Verification" />
                <div className="flex flex-grow flex-col justify-center space-y-4">
                    <h3 className="text-sm font-bold">Verify your details</h3>
                    <UserDetailsForm
                        ref={formRef}
                        onSubmit={handleUserDetailsSubmit}
                        isSubmitting={isUpdatingUser}
                        onValidChange={setIsUserDetailsFormValid}
                        initialData={initialUserDetails}
                    />
                    <Button
                        onClick={() => formRef.current?.handleSubmit()}
                        loading={isUpdatingUser}
                        variant="purple"
                        shadowSize="4"
                        className="w-full"
                        disabled={!isUserDetailsFormValid || isUpdatingUser}
                    >
                        Continue
                    </Button>
                    {userUpdateError && <ErrorAlert description={userUpdateError} />}
                </div>
            </div>
        )
    }

    if (urlState.step === 'kyc') {
        return (
            <div className="flex flex-col justify-start space-y-8">
                <InitiateBridgeKYCModal
                    isOpen={isKycModalOpen}
                    onClose={handleKycModalClose}
                    onKycSuccess={handleKycSuccess}
                    onManualClose={() => router.push(`/add-money/${selectedCountry.path}`)}
                    flow="add"
                />
            </div>
        )
    }

    if (urlState.step === 'showDetails') {
        // Validate we have the required data (protects against deep links and back navigation)
        if (!onrampData?.transferId) {
            setUrlState({ step: 'inputAmount' })
            return <PeanutLoading />
        }
        return <AddMoneyBankDetails />
    }

    if (urlState.step === 'inputAmount') {
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

                    <InfoCard
                        variant="warning"
                        icon="alert"
                        description="This must match what you send from your bank!"
                    />
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={
                            !parseFloat(rawTokenAmount) ||
                            parseFloat(rawTokenAmount) < minimumAmount ||
                            error.showError ||
                            isCreatingOnramp
                        }
                        className="w-full"
                        loading={isCreatingOnramp}
                    >
                        Continue
                    </Button>
                    {error.showError && !!error.errorMessage && <ErrorAlert description={error.errorMessage} />}
                </div>

                <OnrampConfirmationModal
                    visible={showWarningModal}
                    onClose={handleWarningCancel}
                    onConfirm={handleWarningConfirm}
                    amount={rawTokenAmount}
                    currency={getCurrencySymbol(getCurrencyConfig(selectedCountry.id, 'onramp').currency)}
                />
            </div>
        )
    }

    return null
}
