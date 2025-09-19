'use client'

import { useWallet } from '@/hooks/wallet/useWallet'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useState, useMemo, useContext, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { mantecaApi } from '@/services/manteca'
import { useCurrency } from '@/hooks/useCurrency'
import { loadingStateContext } from '@/context'
import { countryData } from '@/components/AddMoney/consts'
import Image from 'next/image'
import { formatAmount } from '@/utils'
import { validateCbuCvuAlias } from '@/utils/withdraw.utils'
import ValidatedInput from '@/components/Global/ValidatedInput'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { formatUnits, parseUnits } from 'viem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { InitiateMantecaKYCModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { useSupportModalContext } from '@/context/SupportModalContext'

type MantecaWithdrawStep = 'amountInput' | 'bankDetails' | 'review' | 'success' | 'failure'

interface MantecaBankDetails {
    destinationAddress: string
}

const MAX_WITHDRAW_AMOUNT = '500'

export default function MantecaWithdrawFlow() {
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [usdAmount, setUsdAmount] = useState<string | undefined>(undefined)
    const [step, setStep] = useState<MantecaWithdrawStep>('amountInput')
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const [bankDetails, setBankDetails] = useState<MantecaBankDetails>({ destinationAddress: '' })
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [isDestinationAddressValid, setIsDestinationAddressValid] = useState(false)
    const [isDestinationAddressChanging, setIsDestinationAddressChanging] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { resetWithdrawFlow } = useWithdrawFlow()
    const { balance } = useWallet()
    const { createLink } = useCreateLink()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const { user, fetchUser } = useAuth()
    const { setIsSupportModalOpen } = useSupportModalContext()

    // Get method and country from URL parameters
    const selectedMethodType = searchParams.get('method') // mercadopago, pix, bank-transfer, etc.
    const countryFromUrl = searchParams.get('country') // argentina, brazil, etc.

    // Determine country and currency from URL params or context
    const countryPath = countryFromUrl || 'argentina'

    // Map country path to CountryData for KYC
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === countryPath)
    }, [countryPath])

    const {
        code: currencyCode,
        symbol: currencySymbol,
        price: currencyPrice,
        isLoading: isCurrencyLoading,
    } = useCurrency(selectedCountry?.currency!)

    // Initialize KYC flow hook
    const { isMantecaKycRequired } = useMantecaKycFlow({ country: selectedCountry })

    // WebSocket listener for KYC status updates
    useWebSocket({
        username: user?.user.username ?? undefined,
        autoConnect: !!user?.user.username,
        onMantecaKycStatusUpdate: (newStatus) => {
            if (newStatus === 'ACTIVE' || newStatus === 'WIDGET_FINISHED') {
                fetchUser()
                setIsKycModalOpen(false)
                setStep('review') // Proceed to review after successful KYC
            }
        },
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
                const { valid, message } = validateCbuCvuAlias(value)
                isValid = valid
                if (!valid) {
                    setErrorMessage(message!)
                }
                break
            default:
                isValid = true
                break
        }

        return isValid
    }

    const handleBankDetailsSubmit = () => {
        if (!bankDetails.destinationAddress.trim()) {
            setErrorMessage('Please enter your account address')
            return
        }
        setErrorMessage(null)

        // Check if we still need to determine KYC status
        if (isMantecaKycRequired === null) {
            // still loading/determining KYC status, don't proceed yet
            return
        }

        // Check KYC status before proceeding to review
        if (isMantecaKycRequired === true) {
            setIsKycModalOpen(true)
            return
        }

        setStep('review')
    }

    const handleWithdraw = async () => {
        if (!bankDetails.destinationAddress || !usdAmount || !currencyCode) return

        try {
            setLoadingState('Preparing transaction')

            const { link } = await createLink(parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS))

            setLoadingState('Withdrawing')
            // Call Manteca withdraw API
            const result = await mantecaApi.withdraw({
                amount: usdAmount,
                destinationAddress: bankDetails.destinationAddress,
                sendLink: link,
                currency: currencyCode,
            })

            if (result.error) {
                setErrorMessage(
                    'Withdraw cancelled, please check that the destination address is correct. If problem persists contact support'
                )
                setStep('failure')
                return
            }

            setStep('success')
        } catch (error) {
            console.error('Manteca withdraw error:', error)
            setErrorMessage(
                'Withdraw cancelled, please check that the destination address is correct. If problem persists contact support'
            )
            setStep('failure')
        } finally {
            setLoadingState('Idle')
        }
    }

    const resetState = () => {
        setStep('amountInput')
        setAmount(undefined)
        setCurrencyAmount(undefined)
        setUsdAmount(undefined)
        setBankDetails({ destinationAddress: '' })
        setErrorMessage(null)
        setIsKycModalOpen(false)
        setIsDestinationAddressValid(false)
        setIsDestinationAddressChanging(false)
        setBalanceErrorMessage(null)
        resetWithdrawFlow()
    }

    useEffect(() => {
        resetState()
    }, [])

    useEffect(() => {
        if (!usdAmount || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount > parseUnits(MAX_WITHDRAW_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`Withdraw amount exceeds maximum limit of $${MAX_WITHDRAW_AMOUNT}`)
        } else if (paymentAmount > balance) {
            setBalanceErrorMessage('Not enough balance to complete withdrawal.')
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance])

    if (isCurrencyLoading || !currencyPrice) {
        return <PeanutLoading />
    }

    if (step === 'success') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
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
                                {currencyCode} {currencyAmount}
                            </div>
                            <div className="text-lg font-bold">≈ ${usdAmount} USD</div>
                            <h1 className="text-sm font-normal text-grey-1">to {bankDetails.destinationAddress}</h1>
                        </div>
                    </Card>
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
            <NavHeader
                title="Withdraw"
                onPrev={() => {
                    if (step === 'review') {
                        setStep('bankDetails')
                    } else if (step === 'bankDetails') {
                        setStep('amountInput')
                    } else {
                        router.push('/withdraw')
                    }
                }}
            />

            {step === 'amountInput' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <div className="text-sm font-bold">Amount to withdraw</div>
                    <TokenAmountInput
                        tokenValue={amount}
                        setTokenValue={setAmount}
                        setCurrencyAmount={setCurrencyAmount}
                        setUsdValue={setUsdAmount}
                        currency={{
                            code: currencyCode!,
                            symbol: currencySymbol!,
                            price: currencyPrice!.sell,
                        }}
                        walletBalance={
                            balance ? formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : undefined
                        }
                    />
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            if (usdAmount) {
                                setStep('bankDetails')
                            }
                        }}
                        disabled={!usdAmount || !!balanceErrorMessage}
                        className="w-full"
                    >
                        Continue
                    </Button>
                    {balanceErrorMessage && <ErrorAlert description={balanceErrorMessage} />}
                </div>
            )}

            {step === 'bankDetails' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    {/* Amount Display Card */}
                    <Card className="p-4">
                        <div className="flex items-center space-x-3">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={`https://flagcdn.com/w160/${countryFlagCode}.png`}
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
                                    <Icon name="arrow-up" size={10} /> You're withdrawing
                                </p>
                                <p className="text-2xl font-bold">
                                    {currencyCode} {currencyAmount}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Bank Details Form */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">Enter {methodDisplayInfo.name} details</h2>

                        <div className="space-y-2">
                            <ValidatedInput
                                value={bankDetails.destinationAddress}
                                placeholder={countryPath === 'argentina' ? 'CBU, CVU or Alias' : 'Account Address'}
                                onUpdate={(update) => {
                                    setBankDetails({ destinationAddress: update.value })
                                    setIsDestinationAddressValid(update.isValid)
                                    setIsDestinationAddressChanging(update.isChanging)
                                    if (update.isValid || update.value === '') {
                                        setErrorMessage(null)
                                    }
                                }}
                                validate={validateDestinationAddress}
                            />

                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Icon name="info" size={16} />
                                <span>You can only withdraw to accounts under your name.</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleBankDetailsSubmit}
                            disabled={
                                !bankDetails.destinationAddress.trim() ||
                                isDestinationAddressChanging ||
                                !isDestinationAddressValid
                            }
                            loading={isDestinationAddressChanging}
                            className="w-full"
                            shadowSize="4"
                        >
                            Review
                        </Button>

                        {errorMessage && <ErrorAlert description={errorMessage} />}
                    </div>

                    {/* KYC Modal */}
                    {isKycModalOpen && selectedCountry && (
                        <InitiateMantecaKYCModal
                            isOpen={isKycModalOpen}
                            onClose={() => setIsKycModalOpen(false)}
                            onManualClose={() => setIsKycModalOpen(false)}
                            onKycSuccess={() => {
                                setIsKycModalOpen(false)
                                fetchUser()
                                setStep('review')
                            }}
                            country={selectedCountry}
                        />
                    )}
                </div>
            )}

            {step === 'review' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="p-4">
                        <div className="flex items-center space-x-3">
                            <div className="relative h-12 w-12">
                                <Image
                                    src={`https://flagcdn.com/w160/${countryFlagCode}.png`}
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
                                    <Icon name="arrow-up" size={10} /> You're withdrawing
                                </p>
                                <p className="text-2xl font-bold">
                                    {currencyCode} {currencyAmount}
                                </p>
                            </div>
                        </div>
                    </Card>
                    {/* Review Summary */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow label="CBU, CVU or Alias" value={bankDetails.destinationAddress} />
                        <PaymentInfoRow
                            label="Exchange Rate"
                            value={`1 USD = ${currencyPrice!.sell} ${currencyCode!.toUpperCase()}`}
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
                    {errorMessage && <ErrorAlert description={errorMessage} />}
                </div>
            )}
        </div>
    )
}
