'use client'

import { Button } from '@/components/0_Bruddle'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/components/AddWithdrawRouterView'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatAmount } from '@/utils'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'

type WithdrawStep = 'inputAmount' | 'selectMethod'

export default function WithdrawPage() {
    const router = useRouter()
    const [step, setStep] = useState<WithdrawStep>('inputAmount')
    const [rawTokenAmount, setRawTokenAmount] = useState<string>('')
    const { setAmountToWithdraw } = useWithdrawFlow()

    const { balance } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    const handleAmountContinue = () => {
        if (parseFloat(rawTokenAmount) > 0) {
            setAmountToWithdraw(rawTokenAmount)
            setStep('selectMethod')
        } else {
            alert('Please enter a valid amount')
        }
    }

    const handleTokenAmountChange = useCallback((value: string | undefined) => {
        setRawTokenAmount(value || '')
    }, [])

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Withdraw" onPrev={() => router.push('/home')} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">Amount to withdraw</div>
                    <TokenAmountInput
                        tokenValue={rawTokenAmount}
                        setTokenValue={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                    />
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={!parseFloat(rawTokenAmount) || parseFloat(rawTokenAmount) <= 0}
                        className="w-full"
                    >
                        Continue
                    </Button>
                </div>
            </div>
        )
    }

    if (step === 'selectMethod') {
        return (
            <AddWithdrawRouterView
                flow="withdraw"
                pageTitle="Withdraw"
                mainHeading="How would you like to withdraw?"
                recentMethods={[]}
                onBackClick={() => setStep('inputAmount')}
            />
        )
    }

    return null
}
