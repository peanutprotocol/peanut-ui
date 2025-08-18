'use client'

import PaymentPage from '@/app/[...recipient]/client'
import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN } from '@/constants'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { DaimoPayButton, useDaimoPayUI } from '@daimo/pay'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { getAddress } from 'viem'
import { arbitrum } from 'viem/chains'

export default function AddMoneyCryptoDirectPage() {
    const router = useRouter()
    const { address } = useWallet()
    const searchParams = useSearchParams()
    const { user } = useUserStore()
    const [recipientUsername, setRecipientUsername] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const dispatch = useAppDispatch()
    const [inputTokenAmount, setInputTokenAmount] = useState<string>('')
    const { resetPayment } = useDaimoPayUI()

    useEffect(() => {
        dispatch(paymentActions.resetPaymentState())
    }, [dispatch])

    useEffect(() => {
        if (user?.user.username) {
            setRecipientUsername(user.user.username)
        } else {
            router.replace('/add-money/crypto')
            return
        }
        setIsLoading(false)
    }, [searchParams, router, user])

    if (isLoading) {
        return <PeanutLoading />
    }

    const resetPaymentAmount = async () => {
        await resetPayment({
            toUnits: inputTokenAmount,
        })
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
                        appId="pay-demo"
                        intent="Deposit"
                        toChain={arbitrum.id}
                        toUnits={inputTokenAmount}
                        toAddress={getAddress(address)}
                        toToken={getAddress(PEANUT_WALLET_TOKEN)} // USDC on arbitrum
                        onPaymentBounced={(e) => {
                            console.log(e)
                        }}
                        paymentOptions={['Coinbase', 'Binance', 'Lemon']}
                    >
                        {({ show }) => (
                            <Button
                                onClick={async () => {
                                    await resetPaymentAmount()
                                    show()
                                }}
                                variant="purple"
                                // loading={isProcessing}
                                shadowSize="4"
                                // onClick={handleInitiatePayment}
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
            </div>
        </div>
    )
}
