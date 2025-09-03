'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { mantecaApi, type QrPaymentResponse } from '@/services/manteca'
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
import { SuccessViewDetailsCard } from '@/components/Global/SuccessViewComponents/SuccessViewDetailsCard'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { formatUnits, parseUnits } from 'viem'
import type { Address } from 'viem'

const paymentData1 = {
    qrPayment: {
        id: '68a5e5dc80f7cf5cc2fa8812',
        numberId: '8565',
        userId: '689b92079258d7dd1c6f6a73',
        userNumberId: '100011086',
        userExternalId: '11ce83b6-e52d-4ecf-bea1-85e58052b688',
        status: 'STARTING',
        type: 'QR3_PAYMENT',
        details: {
            depositAddress: '0xB9D77f0A3e954109dDae3C302Ac56C87baD60440' as Address,
            paymentAssetAmount: '3268.68',
            paymentPrice: '1200.00',
            paymentAgainstAmount: '2.72390000',
            paymentAsset: 'ARS',
            paymentAgainst: 'USDT',
            qrType: 'QR3',
            priceExpireAt: '2025-08-20T12:17:11.760-03:00',
            merchant: {
                name: 'Diego Maradona',
                legalId: '20415301087',
                category: 'AGRICULTURAL_SERVICES',
                categoryCode: '0473',
            },
        },
        currentStage: 1,
        stages: {
            '1': {
                stageType: 'ORDER',
                side: 'SELL',
                type: 'MARKET',
                asset: 'USDT',
                against: 'ARS',
                assetAmount: '2.72390000',
                price: '1200.00',
                priceCode: 'b44d2fd3-77ac-4222-845c-87e425bf231b',
            },
            '2': {
                stageType: 'WITHDRAW',
                network: 'QR3',
                asset: 'ARS',
                amount: '3268.68',
                to: 'ARS-.-3268.68-.-Diego Maradona-.-ARG-.-20415301087-.-00020101021140200010com.yacare02022350150011336972350495204739953030325802AR5910HAVANNA SA6012BUENOS AIRES81220010com.yacare0204Y2156304E401-.-e30',
                destination: {
                    address:
                        'ARS-.-3268.68-.-Diego Maradona-.-ARG-.-20415301087-.-00020101021140200010com.yacare02022350150011336972350495204739953030325802AR5910HAVANNA SA6012BUENOS AIRES81220010com.yacare0204Y2156304E401-.-e30',
                    network: 'QR3',
                },
            },
        },
        creationTime: '2025-08-20T12:12:28.077-03:00',
        updatedAt: '2025-08-20T12:12:28.077-03:00',
    },
    charge: {
        id: '68a5e5dc80f7cf5cc2fa8812',
        uuid: '68a5e5dc80f7cf5cc2fa8812',
        chainId: 'ARS',
        hash: '0x0',
        tokenAddress: '0xfab98b6f3F4c861fCEBD371cD626b31c7920e6E1',
        payerAddress: '0xfab98b6f3F4c861fCEBD371cD626b31c7920e6E1',
        amount: '3268.68',
        status: 'PENDING',
        createdAt: '2025-08-20T12:12:28.077-03:00',
        updatedAt: '2025-08-20T12:12:28.077-03:00',
        userId: '689b92079258d7dd1c6f6a73',
        userExternalId: '11ce83b6-e52d-4ecf-',
    },
}

export default function QRPayPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const qrCode = searchParams.get('qrCode')
    const { balance, sendMoney, address } = useWallet()
    const [isSuccess, setIsSuccess] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isUserAmountRequired, setIsUserAmountRequired] = useState(false)
    const [amount, setAmount] = useState<string | undefined>(undefined)
    const [qrPayment, setQrPayment] = useState<QrPaymentResponse['qrPayment'] | null>(null)

    const {
        data: paymentData,
        isLoading,
        isError: isErrorInitiatingPayment,
        error: errorInitiatingPayment,
    } = useQuery({
        queryKey: ['qr-payment', qrCode],
        queryFn: async () => {
            if (!qrCode) {
                throw new Error('No QR code found')
            }
            try {
                const response = await mantecaApi.initiateQrPayment({ qrCode })
                setAmount(response.qrPayment.details.paymentAssetAmount)
                return response
            } catch (error: unknown) {
                if (error instanceof Error && error.message === 'Missing amount') {
                    setIsUserAmountRequired(true)
                    return null
                }
                throw error
            }
        },
        enabled: !!qrCode,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    })

    const usdAmount = useMemo(() => {
        if (!paymentData?.qrPayment) return null
        return paymentData.qrPayment.details.paymentAgainstAmount
    }, [paymentData])

    const methodIcon = useMemo(() => {
        if (!paymentData) return null
        switch (paymentData.qrPayment.type) {
            case 'QR3_PAYMENT':
                return MERCADO_PAGO
            case 'PIX':
                return PIX
            default:
                return null
        }
    }, [paymentData])


    const payQR = useCallback(async () => {
        if (!paymentData || !usdAmount) return
        const { userOpHash, receipt } = await sendMoney(paymentData.qrPayment.details.depositAddress, usdAmount)
        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage('Transaction reverted by the network.')
            setIsSuccess(false)
            return
        }
        const txHash = receipt?.transactionHash ?? userOpHash
        chargesApi.createPayment({
            chargeId: paymentData.charge.uuid,
            chainId: paymentData.charge.chainId,
            hash: txHash,
            tokenAddress: paymentData.charge.tokenAddress,
            payerAddress: address,
        })
        setIsSuccess(true)
    }, [paymentData, sendMoney, setIsSuccess, setErrorMessage, usdAmount])

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

    if (isLoading || (!paymentData && !isUserAmountRequired)) {
        return <PeanutLoading />
    }

    //Success
    if (isSuccess) {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Pay" />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <SuccessViewDetailsCard
                        title={`You paid ${paymentData.qrPayment.details.merchant.name}`}
                        amountDisplay={`AR ${paymentData.qrPayment.details.paymentAssetAmount}`}
                        status={'completed'}
                    />
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
                            onClick={() => {
                                if (transactionForDrawer) {
                                    openTransactionDetails(transactionForDrawer)
                                }
                            }}
                            disabled={!transactionForDrawer}
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
                {paymentData && (
                <Card className="p-4">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center rounded-full bg-white">
                            <Image src={methodIcon} alt="Mercado Pago" width={50} height={50} />
                        </div>
                        <div>
                            <p className="flex items-center text-center gap-1 text-sm text-gray-600">
                            <Icon name="arrow-up-right" size={10} /> You're paying
                            </p>
                            <p className="text-xl font-semibold">{paymentData.qrPayment.details.merchant.name}</p>
                        </div>
                    </div>
                </Card>
                )}

                {/* Amount Card */}
                <TokenAmountInput
                    tokenValue={amount}
                    setTokenValue={setAmount}
                    currency={{
                        code: paymentData.qrPayment.details.paymentAsset,
                        symbol: paymentData.qrPayment.details.paymentAsset,
                        price: Number(paymentData.qrPayment.details.paymentPrice),
                    }}
                    disabled={true}
                    walletBalance={balance ? formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS) : undefined}
                />

                {/* Send Button */}
                <Button
                    onClick={payQR}
                    icon="arrow-up-right"
                    iconSize={10}
                    shadowSize="4"
                    loading={isLoading}
                    disabled={isErrorInitiatingPayment || !!errorMessage || isLoading}
                >
                    Send
                </Button>

                {/* Error State */}
                {errorMessage && <ErrorAlert description={errorMessage} />}
            </div>
        </div>
    )
}
