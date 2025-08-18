'use client'

import { CryptoWithdrawFlow } from '@/components/Payment/flows'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function WithdrawCryptoPage() {
    const router = useRouter()
    const { amountToWithdraw, resetWithdrawFlow } = useWithdrawFlow()

    // Redirect if no amount is set
    useEffect(() => {
        if (!amountToWithdraw) {
            console.error('Amount not available for crypto withdrawal, redirecting.')
            router.push('/withdraw')
            return
        }
    }, [amountToWithdraw, router])

    const handleComplete = () => {
        // Clean up the context state and go home
        resetWithdrawFlow()
        router.push('/home')
    }

    if (!amountToWithdraw) {
        return <PeanutLoading />
    }

    return (
        <div className="mx-auto h-full min-h-[inherit] w-full max-w-md space-y-4 self-center">
            <CryptoWithdrawFlow initialAmount={amountToWithdraw} onComplete={handleComplete} />
        </div>
    )
}
