'use client'

import { Button } from '@/components/0_Bruddle'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
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
import Cookies from 'js-cookie'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import Image from 'next/image'
import Icon from '@/components/Global/Icon'

type AddStep = 'inputAmount' | 'selectMethod' | 'kyc'

export default function AddMoneyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<AddStep>('selectMethod')
    const [rawTokenAmount, setRawTokenAmount] = useState<string>('')
    const [showWarningModal, setShowWarningModal] = useState<boolean>(false)
    const [isRiskAccepted, setIsRiskAccepted] = useState<boolean>(false)
    const [isCreatingOnramp, setIsCreatingOnramp] = useState<boolean>(false)
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [liveKycStatus, setLiveKycStatus] = useState<KYCStatus | undefined>(undefined)
    const {
        amountToOnramp: amountFromContext,
        setAmountToOnramp,
        setError,
        error,
        fromBankSelected,
        setFromBankSelected,
    } = useOnrampFlow()

    const { balance } = useWallet()
    const { user, fetchUser } = useAuth()

    // Get selected country from URL parameters
    const selectedCountryPath = searchParams.get('country')
    const selectedCountry = useMemo(() => {
        if (!selectedCountryPath) return null
        return countryData.find((country) => country.type === 'country' && country.path === selectedCountryPath)
    }, [selectedCountryPath])

    // Set up WebSocket for KYC status updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onKycStatusUpdate: (newStatus) => {
            setLiveKycStatus(newStatus as KYCStatus)
        },
    })

    // Update live KYC status when user changes
    useEffect(() => {
        if (user?.user.kycStatus) {
            setLiveKycStatus(user.user.kycStatus as KYCStatus)
        }
    }, [user?.user.kycStatus])

    // Fetch user data on component mount
    useEffect(() => {
        fetchUser()
    }, [])

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    // Handle URL parameter for fromBank selection
    useEffect(() => {
        const fromBankParam = searchParams.get('fromBank')
        if (fromBankParam === 'true' && !fromBankSelected) {
            setFromBankSelected(true)
        }
    }, [searchParams, fromBankSelected, setFromBankSelected])

    useEffect(() => {
        if (fromBankSelected) {
            // Check if user needs KYC verification
            const currentKycStatus = liveKycStatus || user?.user.kycStatus
            const isUserKycVerified = currentKycStatus === 'approved'

            if (!isUserKycVerified) {
                setStep('kyc')
            } else {
                setStep('inputAmount')
                if (amountFromContext && !rawTokenAmount) {
                    setRawTokenAmount(amountFromContext)
                }
            }
        } else {
            setStep('selectMethod')
        }
    }, [fromBankSelected, amountFromContext, rawTokenAmount, liveKycStatus, user?.user.kycStatus])

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

            if (Number.isFinite(amount) && amount >= 1) {
                setError({ showError: false, errorMessage: '' })
                return true
            } else {
                let message = 'Please enter a valid amount.'
                if (!Number.isFinite(amount)) {
                    message = 'Please enter a valid number.'
                } else if (amount < 1) {
                    message = 'Minimum deposit is 1.'
                }
                setError({
                    showError: true,
                    errorMessage: message,
                })
                return false
            }
        },
        [setError]
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
        setAmountToOnramp(rawTokenAmount)
        setShowWarningModal(false)
        setIsRiskAccepted(false)
        setIsCreatingOnramp(true)

        try {
            const jwtToken = Cookies.get('jwt-token')

            // Get currency from selected country, default to USD
            const currency = selectedCountry?.id === 'US' ? 'usd' : selectedCountry?.id === 'MX' ? 'mxn' : 'eur'
            const paymentRail =
                selectedCountry?.id === 'US' ? 'ach_push' : selectedCountry?.id === 'MX' ? 'spei' : 'sepa'

            // Call backend to create onramp via proxy route
            const response = await fetch(`/api/proxy/bridge/onramp/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwtToken}`,
                },
                body: JSON.stringify({
                    amount: rawTokenAmount,
                    source: {
                        currency: currency,
                        paymentRail: paymentRail,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const onrampData = await response.json()

            // Store the response data in sessionStorage for the bank page
            sessionStorage.setItem('onrampData', JSON.stringify(onrampData))

            // Navigate to country-specific bank page or default to US
            const bankPath = selectedCountry?.path || 'usa'
            router.push(`/add-money/${bankPath}/bank`)
        } catch (error) {
            console.error('Error creating onramp:', error)
            // Show error to user
            setError({
                showError: true,
                errorMessage: 'Failed to create bank transfer. Please try again.',
            })
            setShowWarningModal(false)
        } finally {
            setIsCreatingOnramp(false)
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

    const handleBackFromAmount = () => {
        setFromBankSelected(false)
        setAmountToOnramp('')
        setRawTokenAmount('')
        setStep('selectMethod')
        // Navigate back to country selection or main page
        if (selectedCountry) {
            router.replace(`/add-money/${selectedCountry.path}`)
        } else {
            // Clear country parameter and go back to main add-money page
            router.replace('/add-money')
        }
    }

    const handleBackFromKyc = () => {
        setFromBankSelected(false)
        setStep('selectMethod')
        // Navigate back to country selection or main page
        if (selectedCountry) {
            router.replace(`/add-money/${selectedCountry.path}`)
        } else {
            router.replace('/add-money')
        }
    }

    if (step === 'kyc') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Add Money" onPrev={handleBackFromKyc} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-6 text-center md:my-0">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">Verify your identity</h2>
                        <p className="text-sm text-grey-1">
                            To add money from your bank account, you need to complete identity verification first. This
                            usually takes just a few minutes.
                        </p>
                    </div>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleKycModalOpen}
                        className="w-full"
                        icon="badge"
                    >
                        Start verification
                    </Button>
                </div>
                <InitiateKYCModal
                    isOpen={isKycModalOpen}
                    onClose={handleKycModalClose}
                    onKycSuccess={handleKycSuccess}
                />
            </div>
        )
    }

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Add Money" onPrev={handleBackFromAmount} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">How much do you want to add?</div>
                    <TokenAmountInput
                        tokenValue={rawTokenAmount}
                        setTokenValue={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
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
                            parseFloat(rawTokenAmount) < 1 ||
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

    if (step === 'selectMethod') {
        return (
            <AddWithdrawRouterView
                flow="add"
                pageTitle="Add Money"
                mainHeading="Where to add money from?"
                onBackClick={() => {
                    if (fromBankSelected) {
                        handleBackFromAmount()
                    } else {
                        router.push('/home')
                    }
                }}
            />
        )
    }
}
