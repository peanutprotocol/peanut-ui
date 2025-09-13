'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
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
import { isTxReverted } from '@/utils/general.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { formatUnits, parseUnits } from 'viem'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { loadingStateContext } from '@/context'
import { getCurrencyPrice } from '@/app/actions/currency'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { captureException } from '@sentry/nextjs'
import { isQRPay } from '@/components/Global/DirectSendQR/utils'

const MANTECA_DEPOSIT_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

export default function QRPayPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const qrCode = searchParams.get('qrCode')
    const timestamp = searchParams.get('t')
    const { balance, sendMoney } = useWallet()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isBalanceError, setIsBalanceError] = useState(false)
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

    const resetState = () => {
        setIsSuccess(false)
        setErrorMessage(null)
        setIsBalanceError(false)
        setErrorInitiatingPayment(null)
        setPaymentLock(null)
        setIsFirstLoad(true)
        setAmount(undefined)
        setCurrencyAmount(undefined)
        setQrPayment(null)
        setCurrency(undefined)
        setLoadingState('Idle')
    }

    // First fetch for qrcode info
    useEffect(() => {
        resetState()

        if (!qrCode || !isQRPay(qrCode)) {
            setErrorInitiatingPayment('Invalid QR code scanned')
            return
        }

        mantecaApi
            .initiateQrPayment({ qrCode })
            .then((paymentLock) => {
                setPaymentLock(paymentLock)
            })
            .catch((error) => {
                setErrorInitiatingPayment(error.message)
            })
            .finally(() => {
                setIsFirstLoad(false)
            })
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
        if (!paymentLock) return null
        switch (paymentLock.type) {
            case 'QR3_PAYMENT':
            case 'QR3':
                return MERCADO_PAGO
            case 'PIX':
                return PIX
            default:
                return null
        }
    }, [paymentLock])

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
            setIsBalanceError(false)
            return
        }
        setIsBalanceError(parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS) > balance)
    }, [usdAmount, balance])

    if (!!errorInitiatingPayment) {
        return (
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="shadow-4">
                    <Card.Header>
                        <Card.Title>Unable to get QR details</Card.Title>
                        <Card.Description>
                            {errorInitiatingPayment || 'An error occurred while getting the QR details.'}
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <Button onClick={() => router.back()} variant="purple">
                            Go Back
                        </Button>
                    </Card.Content>
                </Card>
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
                            <div className="text-lg font-bold">≈ {usdAmount} U$D</div>
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
                {isBalanceError && <ErrorAlert description={'Not enough balance to complete payment. Add funds!'} />}

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
                    disabled={!!errorInitiatingPayment || !!errorMessage || !amount || isLoading || isBalanceError}
                >
                    {isLoading ? loadingState : 'Pay'}
                </Button>

                {/* Error State */}
                {errorMessage && <ErrorAlert description={errorMessage} />}
            </div>
        </div>
    )
}
