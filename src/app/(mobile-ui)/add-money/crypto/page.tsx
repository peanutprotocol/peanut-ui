'use client'

import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const AddMoneyCryptoPage = () => {
    const { user } = useAuth()
    const router = useRouter()
    const { address: peanutWalletAddress } = useWallet()
    const [network] = useQueryState(
        'network',
        parseAsStringEnum<RhinoChainType>(['EVM', 'SOL', 'TRON']).withDefault('EVM')
    )
    const [showSuccessView, setShowSuccessView] = useState(false)
    const [depositedAmount, setDepositedAmount] = useState(0)

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', user?.user.userId, network],
        queryFn: () =>
            rhinoApi.createDepositAddress(peanutWalletAddress as string, network, user?.user.userId as string),
        enabled: !!user && !!peanutWalletAddress,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const handleSuccess = useCallback(
        (amount: number) => {
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
                amount,
                chain_type: network,
                method_type: 'crypto',
            })
            setDepositedAmount(amount)
            setShowSuccessView(true)
        },
        [network]
    )

    if (showSuccessView) {
        return <PaymentSuccessView type="DEPOSIT" usdAmount={depositedAmount.toString()} />
    }

    return (
        <CryptoDepositView
            network={network}
            depositAddressData={depositAddressData}
            isLoading={isLoading}
            onSuccess={handleSuccess}
            onBack={() => router.push('/add-money')}
        />
    )
}

export default AddMoneyCryptoPage
