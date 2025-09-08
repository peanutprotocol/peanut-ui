'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { mantecaApi } from '@/services/manteca'
import type { QrPayment, QrPaymentCharge, QrPaymentLock } from '@/services/manteca'
import NavHeader from '@/components/Global/NavHeader'
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { useWallet } from '@/hooks/wallet/useWallet'
import { isTxReverted } from '@/utils/general.utils'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { chargesApi } from '@/services/charges'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { formatUnits, parseUnits } from 'viem'
import { getCurrencyPrice } from '@/app/actions/currency'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { loadingStateContext } from '@/context'

export default function QRPayPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const qrCode = searchParams.get('qrCode')
    const { balance, sendMoney, address } = useWallet()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [currencyAmount, setCurrencyAmount] = useState<string | undefined>(undefined)
    const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
    const [charge, setCharge] = useState<QrPaymentCharge | null>(null)
    const [paymentLock, setPaymentLock] = useState<QrPaymentLock | null>(null)
    const [currency, setCurrency] = useState<{ code: string; symbol: string; price: number } | undefined>(undefined)
    const { openTransactionDetails, selectedTransaction } = useTransactionDetailsDrawer()
    const { isLoading, loadingState } = useContext(loadingStateContext)

    const {
        data: paymentResponse,
        isFetching,
        isError: isErrorInitiatingPayment,
        error: errorInitiatingPayment,
        refetch: refetchPayment,
        dataUpdatedAt,
    } = useQuery({
        // DONT add amount to the key, we refetch manually
        queryKey: ['qr-payment', qrCode],
        queryFn: async () => {
            if (!qrCode) {
                throw new Error('No QR code found')
            }
            return await mantecaApi.initiateQrPayment({ qrCode, amount: currencyAmount })
        },
        enabled: !!qrCode,
        staleTime: 1,
        refetchOnMount: 'always',
        retry: false,
    })

    const resetState = () => {
        setIsSuccess(false)
        setErrorMessage(null)
        setAmount(undefined)
        setCurrencyAmount(undefined)
        setQrPayment(null)
        setCharge(null)
        setPaymentLock(null)
        setCurrency(undefined)
    }

    useEffect(() => {
        resetState()
        if (!paymentResponse) return
        const getCurrencyObject = async () => {
            let currencyCode: string
            let price: number
            if ('qrPayment' in paymentResponse) {
                currencyCode = paymentResponse.qrPayment.details.paymentAsset
                price = Number(paymentResponse.qrPayment.details.paymentPrice)
            } else {
                currencyCode = paymentResponse.paymentLock.paymentAsset
                price = await getCurrencyPrice(currencyCode)
            }
            return {
                code: currencyCode,
                symbol: currencyCode,
                price,
            }
        }
        if ('qrPayment' in paymentResponse) {
            setQrPayment(paymentResponse.qrPayment)
            setCharge(paymentResponse.charge)
            setAmount(paymentResponse.qrPayment.details.paymentAssetAmount)
        } else {
            setPaymentLock(paymentResponse.paymentLock)
        }
        getCurrencyObject().then(setCurrency)
        // dataUpdatedAt is added because reference to paymeentResponse
        // does not change on refetch or on mount but dataUpdatedAt does
    }, [paymentResponse, dataUpdatedAt])

    const usdAmount = useMemo(() => {
        if (!qrPayment) return null
        return qrPayment.details.paymentAgainstAmount
    }, [qrPayment])

    const methodIcon = useMemo(() => {
        if (!qrPayment && !paymentLock) return null
        switch (qrPayment?.type ?? paymentLock!.type) {
            case 'QR3_PAYMENT':
            case 'QR3':
                return MERCADO_PAGO
            case 'PIX':
                return PIX
            default:
                return null
        }
    }, [qrPayment, paymentLock])

    const merchantName = useMemo(() => {
        if (!qrPayment && !paymentLock) return null
        return qrPayment?.details.merchant.name ?? paymentLock!.paymentRecipientName
    }, [qrPayment, paymentLock])

    const payQR = useCallback(async () => {
        if (!qrPayment || !charge || !usdAmount) return
        const { userOpHash, receipt } = await sendMoney(qrPayment.details.depositAddress, usdAmount)
        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage('Transaction reverted by the network.')
            setIsSuccess(false)
            return
        }
        const txHash = receipt?.transactionHash ?? userOpHash
        chargesApi.createPayment({
            chargeId: charge.uuid,
            chainId: charge.chainId,
            hash: txHash,
            tokenAddress: charge.tokenAddress,
            payerAddress: address,
        })
        setIsSuccess(true)
    }, [qrPayment, charge, sendMoney, usdAmount])

    // Check user balance
    useEffect(() => {
        if (!usdAmount || balance === undefined) return
        if (parseUnits(usdAmount, PEANUT_WALLET_TOKEN_DECIMALS) > balance) {
            setErrorMessage('Insufficient funds')
        }
    }, [usdAmount, balance, setErrorMessage])

    if (isErrorInitiatingPayment) {
        return (
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <Card className="shadow-4">
                    <Card.Header>
                        <Card.Title>Unable to get QR details</Card.Title>
                        <Card.Description>
                            {errorInitiatingPayment.message || 'An error occurred while getting the QR details.'}
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

    if (isFetching || !paymentResponse || !currency) {
        return <PeanutLoading />
    }

    //Success
    if (isSuccess && !qrPayment) {
        // This should never happen, if this happens there is dev error
        throw new Error('Invalid state, successful payment but no QR payment data')
    } else if (isSuccess) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Pay" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex items-center gap-3 p-4">
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
                            <h2 className="text-2xl font-extrabold">
                                {currency.symbol} {amount}
                            </h2>
                        </div>
                    </Card>
                    <div className="w-full space-y-5">
                        <Button
                            onClick={() => {
                                router.push('/home')
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
                                openTransactionDetails({
                                    id: qrPayment!.id,
                                    direction: 'send',
                                    userName: qrPayment!.details.merchant.name,
                                    amount: Number(usdAmount),
                                    currency: {
                                        amount: amount!,
                                        code: currency.code,
                                    },
                                    initials: 'QR',
                                    currencySymbol: currency.symbol,
                                    status: 'completed',
                                    date: new Date(),
                                    extraDataForDrawer: {
                                        originalType: EHistoryEntryType.MANTECA_QR_PAYMENT,
                                        originalUserRole: EHistoryUserRole.SENDER,
                                    },
                                })
                            }}
                        >
                            See receipt
                        </Button>
                    </div>
                </div>
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
                        key={qrPayment?.id}
                        tokenValue={amount}
                        setTokenValue={setAmount}
                        currency={currency}
                        disabled={!!qrPayment || isFetching}
                        walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                        setCurrencyAmount={setCurrencyAmount}
                    />
                )}

                {/* Send Button */}
                <Button
                    onClick={() => {
                        if (qrPayment) {
                            payQR()
                        } else {
                            refetchPayment()
                        }
                    }}
                    icon="arrow-up-right"
                    iconSize={10}
                    shadowSize="4"
                    loading={isFetching || isLoading}
                    disabled={isErrorInitiatingPayment || !!errorMessage || isFetching || !amount || isLoading}
                >
                    {isLoading ? loadingState : qrPayment ? 'Send' : 'Confirm Amount'}
                </Button>

                {/* Error State */}
                {errorMessage && <ErrorAlert description={errorMessage} />}
            </div>
            <TransactionDetailsReceipt transaction={selectedTransaction} />
        </div>
    )
}
