'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/KycVerificationInProgressModal'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { mantecaApi } from '@/services/manteca'
import type { QrPayment, QrPaymentLock } from '@/services/manteca'
import NavHeader from '@/components/Global/NavHeader'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import Image from 'next/image'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { useWallet } from '@/hooks/wallet/useWallet'
import { clearRedirectUrl, getRedirectUrl, isTxReverted } from '@/utils/general.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants/manteca.consts'
import { formatUnits, parseUnits } from 'viem'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { loadingStateContext } from '@/context'
import { getCurrencyPrice } from '@/app/actions/currency'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { captureException } from '@sentry/nextjs'
import { isPaymentProcessorQR } from '@/components/Global/DirectSendQR/utils'
import { QrKycState, useQrKycGate } from '@/hooks/useQrKycGate'
import ActionModal from '@/components/Global/ActionModal'
import { saveRedirectUrl } from '@/utils/general.utils'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { EQrType } from '@/components/Global/DirectSendQR/utils'

const MAX_QR_PAYMENT_AMOUNT = '200'

export default function QRPayPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const qrCode = decodeURIComponent(searchParams.get('qrCode') || '')
    const timestamp = searchParams.get('t')
    const qrType = searchParams.get('type')
    const { balance, sendMoney } = useWallet()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [balanceErrorMessage, setBalanceErrorMessage] = useState<string | null>(null)
    const [errorInitiatingPayment, setErrorInitiatingPayment] = useState<string | null>(null)
    const [paymentLock, setPaymentLock] = useState<QrPaymentLock | null>(null)
    const [isFirstLoad, setIsFirstLoad] = useState(true)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
    const [currency, setCurrency] = useState<{ code: string; symbol: string; price: number } | undefined>(undefined)
    const { openTransactionDetails, selectedTransaction, isDrawerOpen, closeTransactionDetails } =
        useTransactionDetailsDrawer()
    const { isLoading, loadingState, setLoadingState } = useContext(loadingStateContext)
    const { shouldBlockPay, kycGateState } = useQrKycGate()

    const resetState = () => {
        setIsSuccess(false)
        setErrorMessage(null)
        setBalanceErrorMessage(null)
        setErrorInitiatingPayment(null)
        setPaymentLock(null)
        setIsFirstLoad(true)
        setAmount(undefined)
        setCurrencyAmount(undefined)
        setQrPayment(null)
        setCurrency(undefined)
        setLoadingState('Idle')
    }

    // First fetch for qrcode info — only after KYC gating allows proceeding
    useEffect(() => {
        resetState()

        if (!qrCode || !isPaymentProcessorQR(qrCode)) {
            setErrorInitiatingPayment('Invalid QR code scanned')
            return
        }

        // defer until gating computed later in component
        setIsFirstLoad(false)
        // Trigger on rescan
    }, [timestamp])

    // Get amount from payment lock
    useEffect(() => {
        if (!paymentLock) return
        if (paymentLock.code !== '') {
            setAmount(paymentLock.paymentAssetAmount)
        }
    }, [paymentLock?.code])

    // Get currency object from payment lock
    useEffect(() => {
        if (!paymentLock) return
        const getCurrencyObject = async () => {
            let currencyCode: string
            let price: number
            currencyCode = paymentLock.paymentAsset
            if (paymentLock.code === '') {
                price = (await getCurrencyPrice(currencyCode)).sell
            } else {
                price = Number(paymentLock.paymentPrice)
            }
            return {
                code: currencyCode,
                symbol: currencyCode,
                price,
            }
        }
        getCurrencyObject().then(setCurrency)
    }, [paymentLock?.code])

    const usdAmount = useMemo(() => {
        if (!paymentLock) return null
        if (paymentLock.code === '') {
            return amount
        } else {
            return paymentLock.paymentAgainstAmount
        }
    }, [paymentLock?.code, paymentLock?.paymentAgainstAmount, amount])

    const methodIcon = useMemo(() => {
        switch (qrType) {
            case EQrType.MERCADO_PAGO:
                return MERCADO_PAGO
            case EQrType.ARGENTINA_QR3:
                return 'https://flagcdn.com/w160/ar.png'
            case EQrType.PIX:
                return PIX
            default:
                return null
        }
    }, [qrType])

    // fetch payment lock only when gating allows proceeding and we don't yet have a lock
    useEffect(() => {
        if (!qrCode || !isPaymentProcessorQR(qrCode)) return
        if (!!paymentLock) return
        if (kycGateState !== QrKycState.PROCEED_TO_PAY) return

        setLoadingState('Fetching details')
        mantecaApi
            .initiateQrPayment({ qrCode })
            .then((pl) => setPaymentLock(pl))
            .catch((error) => setErrorInitiatingPayment(error.message))
            .finally(() => setLoadingState('Idle'))
    }, [kycGateState, paymentLock, qrCode, setLoadingState])

    const merchantName = useMemo(() => {
        if (!paymentLock) return null
        return paymentLock.paymentRecipientName
    }, [paymentLock])

    const payQR = useCallback(async () => {
        if (!paymentLock || !qrCode || !currencyAmount) return
        let finalPaymentLock = paymentLock
        if (finalPaymentLock.code === '') {
            setLoadingState('Fetching details')
            try {
                finalPaymentLock = await mantecaApi.initiateQrPayment({ qrCode, amount: currencyAmount })
                setPaymentLock(finalPaymentLock)
            } catch (error) {
                captureException(error)
                setErrorMessage('Could not initiate payment due to unexpected error. Please contact support')
                setIsSuccess(false)
                setLoadingState('Idle')
                return
            }
        }
        if (finalPaymentLock.code === '') {
            finalPaymentLock
            setErrorMessage('Could not fetch qr payment details')
            setIsSuccess(false)
            setLoadingState('Idle')
            return
        }
        setLoadingState('Preparing transaction')
        const { userOpHash, receipt } = await sendMoney(MANTECA_DEPOSIT_ADDRESS, finalPaymentLock.paymentAgainstAmount)
        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage('Transaction reverted by the network.')
            setIsSuccess(false)
            return
        }
        const txHash = receipt?.transactionHash ?? userOpHash
        setLoadingState('Paying')
        try {
            const qrPayment = await mantecaApi.completeQrPayment({ paymentLockCode: finalPaymentLock.code, txHash })
            setQrPayment(qrPayment)
            setIsSuccess(true)
        } catch (error) {
            captureException(error)
            setErrorMessage('Could not complete payment due to unexpected error. Please contact support')
            setIsSuccess(false)
        } finally {
            setLoadingState('Idle')
        }
    }, [paymentLock?.code, sendMoney, usdAmount, qrCode, currencyAmount])

    // Check user balance
    useEffect(() => {
        if (!usdAmount || balance === undefined) {
            setBalanceErrorMessage(null)
            return
        }
        const paymentAmount = parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS)
        if (paymentAmount > parseUnits(MAX_QR_PAYMENT_AMOUNT, PEANUT_WALLET_TOKEN_DECIMALS)) {
            setBalanceErrorMessage(`QR payment amount exceeds maximum limit of $${MAX_QR_PAYMENT_AMOUNT}`)
        } else if (paymentAmount > balance) {
            setBalanceErrorMessage('Not enough balance to complete payment. Add funds!')
        } else {
            setBalanceErrorMessage(null)
        }
    }, [usdAmount, balance])

    if (!!errorInitiatingPayment) {
        return (
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="shadow-4 space-y-2">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-extrabold">Unable to get QR details</h1>
                        <p className="text-lg">
                            {errorInitiatingPayment || 'An error occurred while getting the QR details.'}
                        </p>
                    </div>
                    <div className="h-[1px] bg-black"></div>

                    <Button onClick={() => router.back()} variant="purple">
                        Go Back
                    </Button>
                </Card>
            </div>
        )
    }

    if (shouldBlockPay) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Pay" />
                <MantecaGeoSpecificKycModal
                    isUserBridgeKycApproved={kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER}
                    selectedCountry={{ id: 'AR', title: 'Argentina' }}
                    setIsMantecaModalOpen={() => {
                        router.back()
                    }}
                    isMantecaModalOpen={kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER}
                    onKycSuccess={() => {
                        saveRedirectUrl()
                        const redirectUrl = getRedirectUrl()
                        if (redirectUrl) {
                            clearRedirectUrl()
                            router.push(redirectUrl)
                        } else {
                            router.replace('/home')
                        }
                    }}
                />
                <ActionModal
                    visible={kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION}
                    onClose={() => router.back()}
                    title="Verify your identity to continue"
                    description="You'll need to verify your identity before paying with a QR code. Don't worry it usually just takes a few minutes."
                    icon="shield"
                    ctas={[
                        {
                            text: 'Verify now',
                            onClick: () => {
                                saveRedirectUrl()
                                router.push('/profile/identity-verification')
                            },
                            variant: 'purple',
                            shadowSize: '4',
                            icon: 'check-circle',
                        },
                    ]}
                    footer={<PeanutDoesntStoreAnyPersonalInformation />}
                />
            </div>
        )
    }

    if (isFirstLoad || !paymentLock || !currency) {
        return <PeanutLoading />
    }

    //Success
    if (isSuccess && !qrPayment) {
        // This should never happen, if this happens there is dev error
        return null
    } else if (isSuccess) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Pay" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={
                                    'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold'
                                }
                            >
                                <Icon name="check" size={24} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">
                                You paid {qrPayment!.details.merchant.name}
                            </h1>
                            <div className="text-2xl font-extrabold">
                                {currency.symbol} {qrPayment!.details.paymentAssetAmount}
                            </div>
                            <div className="text-lg font-bold">≈ {usdAmount} USD</div>
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
                        <Button
                            variant="primary-soft"
                            shadowSize="4"
                            disabled={false}
                            onClick={() => {
                                const now = new Date()
                                openTransactionDetails({
                                    id: qrPayment!.id,
                                    direction: 'qr_payment',
                                    userName: qrPayment!.details.merchant.name,
                                    fullName: qrPayment!.details.merchant.name,
                                    amount: Number(usdAmount),
                                    currency: {
                                        amount: qrPayment!.details.paymentAssetAmount,
                                        code: currency.code,
                                    },
                                    initials: 'QR',
                                    currencySymbol: currency.symbol,
                                    status: 'completed',
                                    date: now,
                                    createdAt: now,
                                    extraDataForDrawer: {
                                        originalType: EHistoryEntryType.MANTECA_QR_PAYMENT,
                                        originalUserRole: EHistoryUserRole.SENDER,
                                        avatarUrl: methodIcon,
                                        receipt: {
                                            exchange_rate: currency.price.toString(),
                                        },
                                    },
                                })
                            }}
                        >
                            See receipt
                        </Button>
                    </div>
                </div>
                <TransactionDetailsDrawer
                    isOpen={isDrawerOpen}
                    onClose={closeTransactionDetails}
                    transaction={selectedTransaction}
                />
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Pay" />

            {/* Payment Content */}
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* Merchant Card */}
                <Card className="p-4">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center rounded-full bg-white">
                            <Image src={methodIcon} alt="Mercado Pago" width={50} height={50} />
                        </div>
                        <div>
                            <p className="flex items-center gap-1 text-center text-sm text-gray-600">
                                <Icon name="arrow-up-right" size={10} /> You're paying
                            </p>
                            <p className="text-xl font-semibold">{merchantName}</p>
                        </div>
                    </div>
                </Card>

                {/* Amount Card */}
                {currency && (
                    <TokenAmountInput
                        tokenValue={amount}
                        setTokenValue={setAmount}
                        currency={currency}
                        disabled={!!qrPayment || isLoading || paymentLock?.code !== ''}
                        walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                        setCurrencyAmount={setCurrencyAmount}
                        hideBalance
                    />
                )}
                {balanceErrorMessage && <ErrorAlert description={balanceErrorMessage} />}

                {/* Information Card */}
                <Card className="space-y-0 px-4">
                    <PaymentInfoRow
                        label="Exchange Rate"
                        value={`1 USD = ${currency.price} ${currency.code.toUpperCase()}`}
                    />
                    <PaymentInfoRow label="Peanut fee" value="Sponsored by Peanut!" hideBottomBorder />
                </Card>

                {/* Send Button */}
                <Button
                    onClick={payQR}
                    shadowSize="4"
                    loading={isLoading}
                    disabled={
                        !!errorInitiatingPayment ||
                        !!errorMessage ||
                        !amount ||
                        isLoading ||
                        !!balanceErrorMessage ||
                        shouldBlockPay
                    }
                >
                    {isLoading ? loadingState : 'Pay'}
                </Button>

                {/* Error State */}
                {errorMessage && <ErrorAlert description={errorMessage} />}
            </div>
        </div>
    )
}
