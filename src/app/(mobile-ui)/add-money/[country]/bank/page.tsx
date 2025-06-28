'use client'

import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatAmount } from '@/utils'
import { countryData } from '@/components/AddMoney/consts'
import { InitiateKYCModal } from '@/components/Kyc'
import { KYCStatus } from '@/utils/bridge-accounts.utils'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/context/authContext'
import { useCreateOnramp } from '@/hooks/useCreateOnramp'
import { useRouter, useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import Icon from '@/components/Global/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { UserDetailsForm, type UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import { updateUserById } from '@/app/actions/users'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { getOnrampCurrencyConfig, getCurrencySymbol, getMinimumAmount } from '@/utils/bridge.utils'

type AddStep = 'inputAmount' | 'kyc' | 'loading' | 'collectUserDetails' | 'showDetails'

export default function OnrampBankPage() {
    const router = useRouter()
    const params = useParams()
    const [step, setStep] = useState<AddStep>('loading')
    const [rawTokenAmount, setRawTokenAmount] = useState<string>('')
    const [showWarningModal, setShowWarningModal] = useState<boolean>(false)
    const [isRiskAccepted, setIsRiskAccepted] = useState<boolean>(false)

    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(undefined)
    const { amountToOnramp: amountFromContext, setAmountToOnramp, setError, error } = useOnrampFlow()
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)

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
            setLiveKycStatus(newStatus as KYCStatus)
        },
    })

    useEffect(() => {
        if (user?.user.kycStatus) {
            setLiveKycStatus(user.user.kycStatus as KYCStatus)
        }
    }, [user?.user.kycStatus])

    useEffect(() => {
        fetchUser()
    }, [])

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    const currencyConfig = useMemo(() => {
        if (!selectedCountry?.id) return null
        const { currency } = getOnrampCurrencyConfig(selectedCountry.id)
        return {
            code: currency.toUpperCase(),
            symbol: getCurrencySymbol(currency),
            price: 1, // For bridge currencies, we use 1:1 with the amount entered
        }
    }, [selectedCountry?.id])

    const minimumAmount = useMemo(() => {
        if (!selectedCountry?.id) return 1
        return getMinimumAmount(selectedCountry.id)
    }, [selectedCountry?.id])

    useEffect(() => {
        if (user === null) return // wait for user to be fetched
        if (step === 'loading') {
            const currentKycStatus = liveKycStatus || user?.user.kycStatus
            const isUserKycVerified = currentKycStatus === 'approved'
            const hasUserDetails = user?.user.fullName && user?.user.email

            if (!isUserKycVerified) {
                if (hasUserDetails) {
                    setStep('kyc')
                } else {
                    setStep('collectUserDetails')
                }
            } else {
                setStep('inputAmount')
                if (amountFromContext && !rawTokenAmount) {
                    setRawTokenAmount(amountFromContext)
                }
            }
        }
    }, [liveKycStatus, user, step, amountFromContext, rawTokenAmount])

    // Handle KYC completion
    useEffect(() => {
        if (step === 'kyc' && liveKycStatus === 'approved') {
            setStep('inputAmount')
            if (amountFromContext && !rawTokenAmount) {
                setRawTokenAmount(amountFromContext)
            }
        }
    }, [liveKycStatus, step, amountFromContext, rawTokenAmount])

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

    const handleTokenAmountChange = useCallback(
        (value: string | undefined) => {
            setRawTokenAmount(value || '')
        },
        [setRawTokenAmount]
    )

    useEffect(() => {
        if (rawTokenAmount === '') {
            if (!amountFromContext) {
                setError({ showError: false, errorMessage: '' })
            }
        } else {
            validateAmount(rawTokenAmount)
        }
    }, [rawTokenAmount, validateAmount, setError, amountFromContext])

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
        setAmountToOnramp(rawTokenAmount)
        setShowWarningModal(false)
        setIsRiskAccepted(false)
        try {
            const onrampDataResponse = await createOnramp({
                amount: rawTokenAmount,
                country: selectedCountry,
            })
            sessionStorage.setItem('onrampData', JSON.stringify(onrampDataResponse))

            if (onrampDataResponse.transferId) {
                setStep('showDetails')
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

    const handleKycModalOpen = () => {
        setIsKycModalOpen(true)
    }

    const handleKycSuccess = () => {
        setIsKycModalOpen(false)
        setStep('inputAmount')
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
                fullName: `${data.firstName} ${data.lastName}`,
                email: data.email,
            })
            if (result.error) {
                throw new Error(result.error)
            }
            await fetchUser()
            setStep('kyc')
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

    const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
    const lastName = lastNameParts.join(' ')

    const initialUserDetails: Partial<UserDetailsFormData> = useMemo(
        () => ({
            firstName: user?.user.fullName ? firstName : '',
            lastName: user?.user.fullName ? lastName : '',
            email: user?.user.email ?? '',
        }),
        [user?.user.fullName, user?.user.email, firstName, lastName]
    )

    useEffect(() => {
        if (step === 'kyc') {
            setIsKycModalOpen(true)
        }
    }, [step])

    if (step === 'loading') {
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

    if (step === 'collectUserDetails') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
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

    if (step === 'kyc') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <InitiateKYCModal
                    isOpen={isKycModalOpen}
                    onClose={handleKycModalClose}
                    onKycSuccess={handleKycSuccess}
                    onManualClose={() => router.push(`/add-money/${selectedCountry.path}`)}
                    flow="add"
                />
            </div>
        )
    }

    if (step === 'showDetails') {
        return <AddMoneyBankDetails />
    }

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Add Money" onPrev={handleBack} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">How much do you want to add?</div>
                    <TokenAmountInput
                        tokenValue={rawTokenAmount}
                        setTokenValue={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                        hideBalance={true}
                        currency={currencyConfig || undefined}
                    />
                    <div className="flex items-center gap-2 text-xs text-grey-1">
                        <Icon name="info" width={16} height={16} />
                        <span>This must exactly match what you send from your bank</span>
                    </div>
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

                <ActionModal
                    visible={showWarningModal}
                    onClose={handleWarningCancel}
                    icon="alert"
                    iconContainerClassName="bg-yellow-400"
                    iconProps={{ className: 'text-black' }}
                    title="IMPORTANT!"
                    description={
                        <>
                            In the following step you'll see a <strong>"Deposit Message" item</strong>, copy and paste
                            it exactly as it is on the description field of your transfer.
                            <br />
                            <br />
                            <strong>Without it, we won't be able to credit your money.</strong>
                        </>
                    }
                    checkbox={{
                        text: 'I understand and accept the risk.',
                        checked: isRiskAccepted,
                        onChange: setIsRiskAccepted,
                    }}
                    ctas={[
                        {
                            text: 'Continue',
                            variant: isRiskAccepted ? 'purple' : 'dark',
                            shadowSize: '4',
                            onClick: handleWarningConfirm,
                            disabled: !isRiskAccepted,
                            className: 'w-full',
                        },
                    ]}
                    preventClose={false}
                    modalPanelClassName="max-w-md mx-8"
                />
            </div>
        )
    }

    return null
}
