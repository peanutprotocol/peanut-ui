'use client'

import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { DaimoPayButton, useDaimoPayUI } from '@daimo/pay'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { getAddress } from 'viem'
import { arbitrum } from 'viem/chains'

export default function AddMoneyCryptoDirectPage() {
    const router = useRouter()
    const { address } = useWallet()
    const [inputTokenAmount, setInputTokenAmount] = useState<string>('')
    const { resetPayment } = useDaimoPayUI()
    const [isPaymentSuccess, setisPaymentSuccess] = useState(false)
    const [isUpdatingDepositStatus, setIsUpdatingDepositStatus] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const resetPaymentAmount = async () => {
        await resetPayment({
            toUnits: inputTokenAmount.replace(/,/g, ''),
        })
    }

    const onPaymentCompleted = async (e: any) => {
        setIsUpdatingDepositStatus(true)
        // 6 second delay to ensure the payment is indexed in the backend
        await new Promise((resolve) => setTimeout(resolve, 6000))

        // Update the depositor address via API
        try {
            const response = await fetch('/api/deposit', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txHash: e.txHash,
                    payerAddress: e.payment.source?.payerAddress,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                console.error('Failed to update depositor address:', errorData)
            }
        } catch (error) {
            console.error('Error updating depositor address:', error)
        }

        setIsUpdatingDepositStatus(false)
        setisPaymentSuccess(true)
    }

    if (isUpdatingDepositStatus) {
        return <PeanutLoading />
    }

    if (isPaymentSuccess) {
        return (
            <DirectSuccessView
                key={`success-add-money}`}
                headerTitle={'Add Money'}
                type="SEND"
                currencyAmount={`$ ${inputTokenAmount}`}
                isWithdrawFlow={false}
                redirectTo={'/add-money'}
            />
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader
                onPrev={() => {
                    if (window.history.length > 1) {
                        router.back()
                    } else {
                        router.push('/')
                    }
                }}
                title={'Add Money'}
            />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <div className="text-sm font-bold">How much do you want to add?</div>
                <TokenAmountInput
                    tokenValue={inputTokenAmount}
                    setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                    className="w-full"
                    currency={{
                        code: 'USD',
                        symbol: '$',
                        price: 1,
                    }}
                    hideCurrencyToggle
                    hideBalance
                />

                {address && (
                    <DaimoPayButton.Custom
                        appId={
                            process.env.NEXT_PUBLIC_DAIMO_APP_ID ??
                            (() => {
                                throw new Error('Daimo APP ID is required')
                            })()
                        }
                        intent="Deposit"
                        toChain={arbitrum.id}
                        toUnits={inputTokenAmount.replace(/,/g, '')}
                        toAddress={getAddress(address)}
                        toToken={getAddress(PEANUT_WALLET_TOKEN)} // USDC on arbitrum
                        onPaymentCompleted={onPaymentCompleted}
                        closeOnSuccess
                    >
                        {({ show }) => (
                            <Button
                                onClick={async () => {
                                    const formattedAmount = parseFloat(inputTokenAmount.replace(/,/g, ''))
                                    if (formattedAmount <= 0.1) {
                                        setError('Minimum deposit is $0.10.')
                                        return
                                    } else if (formattedAmount > 4000) {
                                        setError('Maximum deposit is $4000.')
                                        return
                                    }
                                    setError(null)
                                    await resetPaymentAmount()
                                    show()
                                }}
                                variant="purple"
                                shadowSize="4"
                                disabled={inputTokenAmount.length == 0}
                                className="w-full"
                                icon={'plus'}
                                iconSize={16}
                            >
                                Add Money
                            </Button>
                        )}
                    </DaimoPayButton.Custom>
                )}

                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
