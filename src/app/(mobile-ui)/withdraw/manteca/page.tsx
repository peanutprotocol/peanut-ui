'use client'

import { useWallet } from '@/hooks/wallet/useWallet'
import { useState, useMemo, useContext, useEffect, useCallback, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { mantecaApi, type WithdrawPriceLock } from '@/services/manteca'
import { useCurrency } from '@/hooks/useCurrency'
import { isTxReverted } from '@/utils/general.utils'
import { loadingStateContext } from '@/context'
import { countryData } from '@/components/AddMoney/consts'
import Image from 'next/image'
import { formatAmount, formatNumberForDisplay } from '@/utils/general.utils'
import { validateCbuCvuAlias, validatePixKey, normalizePixPhoneNumber, isPixPhoneNumber } from '@/utils/withdraw.utils'
import ValidatedInput from '@/components/Global/ValidatedInput'
import AmountInput from '@/components/Global/AmountInput'
import { formatUnits, parseUnits } from 'viem'
import type { TransactionReceipt, Hash } from 'viem'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { useMantecaKycFlow } from '@/hooks/useMantecaKycFlow'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useModalsContext } from '@/context/ModalsContext'
import Select from '@/components/Global/Select'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { useQueryClient } from '@tanstack/react-query'
import { captureException } from '@sentry/nextjs'
import useKycStatus from '@/hooks/useKycStatus'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { PointsAction } from '@/services/services.types'
import { usePointsConfetti } from '@/hooks/usePointsConfetti'
import { usePointsCalculation } from '@/hooks/usePointsCalculation'
import PointsCard from '@/components/Common/PointsCard'
import {
    MANTECA_COUNTRIES_CONFIG,
    MANTECA_DEPOSIT_ADDRESS,
    MantecaAccountType,
    type MantecaBankCode,
} from '@/constants/manteca.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'

type MantecaWithdrawStep = 'amountInput' | 'bankDetails' | 'review' | 'success' | 'failure'

const MAX_WITHDRAW_AMOUNT = '2000'
const MIN_WITHDRAW_AMOUNT = '1'

export default function MantecaWithdrawFlow() {
    const flowId = useId() // Unique ID per flow instance to prevent cache collisions
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [usdAmount, setUsdAmount] = useState<string | undefined>(undefined)
    const [step, setStep] = useState<MantecaWithdrawStep>('amountInput')
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const searchParams = useSearchParams()
    const paramAddress = searchParams.get('destination')
    const isSavedAccount = searchParams.get('isSavedAccount') === 'true'
    const [destinationAddress, setDestinationAddress] = useState<string>(paramAddress ?? '')
    const [selectedBank, setSelectedBank] = useState<MantecaBankCode | null>(null)
    const [accountType, setAccountType] = useState<MantecaAccountType | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)
    const [isDestinationAddressValid, setIsDestinationAddressValid] = useState(false)
    const [isDestinationAddressChanging, setIsDestinationAddressChanging] = useState(false)
    // price lock state - holds the locked price from /withdraw/init
    const [priceLock, setPriceLock] = useState<WithdrawPriceLock | null>(null)
    const [isLockingPrice, setIsLockingPrice] = useState(false)
    const router = useRouter()
    const { sendMoney, balance } = useWallet()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const { user, fetchUser } = useAuth()
    const { setIsSupportModalOpen } = useModalsContext()
    const queryClient = useQueryClient()
    const { isUserBridgeKycApproved } = useKycStatus()
    const { hasPendingTransactions } = usePendingTransactions()
    // Get method and country from URL parameters
    const selectedMethodType = searchParams.get('method') // mercadopago, pix, bank-transfer, etc.
    const countryFromUrl = searchParams.get('country') // argentina, brazil, etc.

    // Determine country and currency from URL params or context
    const countryPath = countryFromUrl || 'argentina'

    // Map country path to CountryData for KYC
    const selectedCountry = useMemo(() => {
        return countryData.find((country) => country.type === 'country' && country.path === countryPath)
    }, [countryPath])

    const countryConfig = useMemo(() => {
        if (!selectedCountry) return undefined
        return MANTECA_COUNTRIES_CONFIG[selectedCountry.id]
    }, [selectedCountry])

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
                const argResult = validateCbuCvuAlias(value)
                isValid = argResult.valid
                if (!argResult.valid) {
                    setErrorMessage(argResult.message!)
                }
                break
            case 'brazil':
                const pixResult = validatePixKey(value)
                isValid = pixResult.valid
                if (!pixResult.valid) {
                    setErrorMessage(pixResult.message!)
                }
                break
            default:
                isValid = true
                break
        }

        return isValid
    }

    const isCompleteBankDetails = useMemo<boolean>(() => {
        return (
            !!destinationAddress.trim() &&
            (!countryConfig?.needsBankCode || selectedBank != null) &&
            (!countryConfig?.needsAccountType || accountType != null)
        )
    }, [selectedBank, accountType, countryConfig, destinationAddress])

    const handleBankDetailsSubmit = useCallback(async () => {
        // prevent duplicate requests from rapid clicks
        if (isLockingPrice) return

        if (!destinationAddress.trim()) {
            setErrorMessage('Please enter your account address')
            return
        }
        if ((countryConfig?.needsBankCode && !selectedBank) || (countryConfig?.needsAccountType && !accountType)) {
            setErrorMessage('Please complete the bank details')
            return
        }
        setErrorMessage(null)

        // check if we still need to determine KYC status
        if (isMantecaKycRequired === null) {
            return
        }

        // check KYC status before proceeding to review
        if (isMantecaKycRequired === true) {
            setIsKycModalOpen(true)
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
                setErrorMessage(result.error)
                return
            }

            if (result.data) {
                setPriceLock(result.data)
                // update the displayed fiat amount to the locked amount
                setCurrencyAmount(result.data.fiatAmount)
                setStep('review')
            }
        } catch (error) {
            captureException(error)
            setErrorMessage('Could not lock exchange rate. Please try again.')
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
        isMantecaKycRequired,
        isLockingPrice,
    ])

    const handleWithdraw = async () => {
        if (!destinationAddress || !usdAmount || !currencyCode) return

        try {
            setLoadingState('Preparing transaction')
            let userOpHash: Hash
            let receipt: TransactionReceipt | null

            try {
                // Send crypto to Manteca address
                const result = await sendMoney(MANTECA_DEPOSIT_ADDRESS, usdAmount)
                userOpHash = result.userOpHash
                receipt = result.receipt
            } catch (error) {
                if ((error as Error).toString().includes('not allowed')) {
                    setErrorMessage('Please confirm the transaction.')
                } else {
                    captureException(error)
                    setErrorMessage('Could not sign the transaction.')
                }
                setLoadingState('Idle')
                return
            }

            if (receipt !== null && isTxReverted(receipt)) {
                setErrorMessage('Transaction reverted by the network.')
                return
            }

            const txHash = receipt?.transactionHash ?? userOpHash
            setLoadingState('Withdrawing')

            // call Manteca withdraw API with the locked price code
            const result = await mantecaApi.withdraw({
                amount: usdAmount,
                destinationAddress: destinationAddress.toLowerCase(),
                bankCode: selectedBank?.code,
                accountType: accountType ?? undefined,
                txHash,
                currency: currencyCode,
                // pass the price lock code to use the locked price
                // if not available (edge case), backend will create a new lock
                priceLockCode: priceLock?.priceLockCode,
            })

            if (result.error) {
                if (result.error === 'Unexpected error') {
                    setErrorMessage('Withdraw failed unexpectedly. If problem persists contact support')
                    setStep('failure')
                } else {
                    setErrorMessage(result.message ?? result.error)
                }
                return
            }

            setStep('success')
        } catch (error) {
            console.error('Manteca withdraw error:', error)
            setErrorMessage('Withdraw failed unexpectedly. If problem persists contact support')
            setStep('failure')
        } finally {
            setLoadingState('Idle')
        }
    }

    const resetState = () => {
        setStep('amountInput')
        setCurrencyAmount(undefined)
        setUsdAmount(undefined)
        setDestinationAddress(paramAddress ?? '')
        setSelectedBank(null)
        setAccountType(null)
        setErrorMessage(null)
        setIsKycModalOpen(false)
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
        if (paymentAmount < parseUnits(MIN_WITHDRAW_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`Withdraw amount must be at least $${MIN_WITHDRAW_AMOUNT}`)
        } else if (paymentAmount > parseUnits(MAX_WITHDRAW_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`Withdraw amount exceeds maximum limit of $${MAX_WITHDRAW_AMOUNT}`)
        } else if (paymentAmount > balance) {
            setBalanceErrorMessage('Not enough balance to complete withdrawal.')
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance, hasPendingTransactions, isLoading])

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

    if (isCurrencyLoading || !currencyPrice || !selectedCountry) {
        return <PeanutLoading />
    }

    if (step === 'success') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <SoundPlayer sound="success" />
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
                                {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                            </div>
                            <div className="text-lg font-bold">
                                ≈ ${formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                            </div>
                            <h1 className="text-sm font-normal text-grey-1">to {destinationAddress}</h1>
                        </div>
                    </Card>

                    {/* Points Display - ref used for confetti origin point */}
                    {pointsData?.estimatedPoints && (
                        <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                    )}

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
                        // clear price lock when going back - user will get a fresh lock when they return
                        setPriceLock(null)
                        setStep('bankDetails')
                    } else if (step === 'bankDetails') {
                        setStep('amountInput')
                    } else {
                        router.back()
                        setTimeout(() => {
                            router.replace(`/withdraw/${selectedCountry?.path}`)
                        }, 100)
                    }
                }}
            />

            {step === 'amountInput' && (
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <div className="text-xl font-bold">Amount to withdraw</div>
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
                        walletBalance={
                            balance ? formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : undefined
                        }
                    />
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
                        disabled={!Number(usdAmount) || !!balanceErrorMessage}
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
                                    {currencyCode} {formatNumberForDisplay(currencyAmount, { maxDecimals: 2 })}
                                </p>
                                <div className="text-lg font-bold">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Bank Details Form */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold">Enter {methodDisplayInfo.name} details</h2>
                        <div className="space-y-2">
                            <ValidatedInput
                                value={destinationAddress}
                                placeholder={countryConfig!.accountNumberLabel}
                                onUpdate={(update) => {
                                    // Auto-normalize PIX phone numbers for Brazil
                                    let normalizedValue = update.value
                                    if (countryPath === 'brazil' && isPixPhoneNumber(update.value)) {
                                        normalizedValue = normalizePixPhoneNumber(update.value)
                                    }
                                    setDestinationAddress(normalizedValue)
                                    setIsDestinationAddressValid(update.isValid)
                                    setIsDestinationAddressChanging(update.isChanging)
                                    if (update.isValid || update.value === '') {
                                        setErrorMessage(null)
                                    }
                                }}
                                validate={validateDestinationAddress}
                            />
                            {countryConfig?.needsAccountType && (
                                <Select
                                    value={accountType ? { id: accountType, title: accountType } : null}
                                    onChange={(item) => {
                                        setAccountType(MantecaAccountType[item.id as keyof typeof MantecaAccountType])
                                    }}
                                    items={countryConfig.validAccountTypes.map((type) => ({ id: type, title: type }))}
                                    placeholder="Select account type"
                                    className="w-full"
                                />
                            )}
                            {countryConfig?.needsBankCode && (
                                <Select
                                    value={selectedBank ? { id: selectedBank.code, title: selectedBank.name } : null}
                                    onChange={(item) => {
                                        setSelectedBank({ code: item.id, name: item.title })
                                    }}
                                    items={countryConfig.validBankCodes.map((bank) => ({
                                        id: bank.code,
                                        title: bank.name,
                                    }))}
                                    placeholder="Select bank"
                                    className="w-full"
                                />
                            )}

                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Icon name="info" size={16} />
                                <span>You can only withdraw to accounts under your name.</span>
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
                            {isLockingPrice ? 'Locking rate...' : 'Review'}
                        </Button>

                        {errorMessage && <ErrorAlert description={errorMessage} />}
                    </div>

                    {/* KYC Modal */}
                    {isKycModalOpen && selectedCountry && (
                        <MantecaGeoSpecificKycModal
                            isUserBridgeKycApproved={isUserBridgeKycApproved}
                            isMantecaModalOpen={isKycModalOpen}
                            setIsMantecaModalOpen={setIsKycModalOpen}
                            onClose={() => setIsKycModalOpen(false)}
                            onManualClose={() => setIsKycModalOpen(false)}
                            onKycSuccess={() => {
                                setIsKycModalOpen(false)
                                fetchUser()
                                setStep('review')
                            }}
                            selectedCountry={selectedCountry}
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
                                    {currencyCode}{' '}
                                    {formatNumberForDisplay(priceLock?.fiatAmount ?? currencyAmount, {
                                        maxDecimals: 2,
                                    })}
                                </p>
                                <div className="text-lg font-bold">
                                    ≈ {formatNumberForDisplay(usdAmount, { maxDecimals: 2 })} USD
                                </div>
                            </div>
                        </div>
                    </Card>
                    {/* Review Summary */}
                    <Card className="space-y-0 px-4">
                        <PaymentInfoRow label={countryConfig!.accountNumberLabel} value={destinationAddress} />
                        <PaymentInfoRow
                            label="Exchange Rate"
                            value={`1 USD = ${priceLock?.price ?? currencyPrice!.sell} ${currencyCode!.toUpperCase()}`}
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
