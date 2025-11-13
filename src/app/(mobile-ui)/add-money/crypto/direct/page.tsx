'use client'

import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import DaimoPayButton from '@/components/Global/DaimoPayButton'
import { DaimoPayWrapper } from '@/components/Global/DaimoPayWrapper'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { trackDaimoDepositTransactionHash } from '@/app/actions/users'
import InfoCard from '@/components/Global/InfoCard'
import Link from 'next/link'

export default function AddMoneyCryptoDirectPage() {
    const router = useRouter()
    const { address } = useWallet()
    const [inputTokenAmount, setInputTokenAmount] = useState<string>('')
    const [isPaymentSuccess, setisPaymentSuccess] = useState(false)
    const [isUpdatingDepositStatus, setIsUpdatingDepositStatus] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const onPaymentCompleted = async (e: any) => {
        setIsUpdatingDepositStatus(true)

        // Save deposit txn hash in the backend to track the user's deposit
        try {
            await trackDaimoDepositTransactionHash({
                txHash: e.txHash,
                payerAddress: e.payment.source.payerAddress,
                sourceChainId: e.payment.source.chainId,
                sourceTokenAddress: e.payment.source.tokenAddress,
            })
        } catch (error) {
            console.error('Error updating depositor address:', error)
        } finally {
            setIsUpdatingDepositStatus(false)
            setisPaymentSuccess(true)
        }
    }

    if (isUpdatingDepositStatus) {
        return <PeanutLoading />
    }

    if (isPaymentSuccess) {
        return (
            <DirectSuccessView
                key={`success-add-money`}
                headerTitle={'Add Money'}
                type="SEND"
                isExternalWalletFlow
                currencyAmount={`$${inputTokenAmount}`}
                isWithdrawFlow={false}
                redirectTo={'/add-money'}
            />
        )
    }

    return (
        <DaimoPayWrapper>
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

                    <InfoCard
                        variant="warning"
                        icon="info"
                        iconSize={14}
                        description="This must match what you send from your wallet or exchange!"
                    />

                    <InfoCard
                        variant="info"
                        icon="alert"
                        title="Peanut cannot recover funds sent to an incorrect address."
                        description={
                            <p>
                                This deposit is processed by Daimo, a third-party provider.{' '}
                                <Link href="/add-money/crypto" className="font-semibold underline">
                                    Click here to deposit with Arbitrum USDC
                                </Link>{' '}
                                for a simple and free deposit.
                            </p>
                        }
                    />
                    {address && (
                        <DaimoPayButton
                            amount={inputTokenAmount}
                            toAddress={address}
                            onPaymentCompleted={onPaymentCompleted}
                            variant="purple"
                            icon="plus"
                            iconSize={16}
                            minAmount={0.1}
                            maxAmount={30_000}
                            onValidationError={setError}
                            disabled={inputTokenAmount === '0.00'}
                        >
                            Add Money
                        </DaimoPayButton>
                    )}

                    <div className="min-h-[20px]">{error && <ErrorAlert description={error} />}</div>
                </div>
            </div>
        </DaimoPayWrapper>
    )
}
