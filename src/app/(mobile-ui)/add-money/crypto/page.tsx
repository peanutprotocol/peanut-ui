'use client'

import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { DepositAddressStatusResponse, RhinoChainType } from '@/services/services.types'
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
    const [depositResult, setDepositResult] = useState<DepositAddressStatusResponse | null>(null)

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', user?.user.userId, network],
        queryFn: () =>
            rhinoApi.createDepositAddress(peanutWalletAddress as string, network, user?.user.userId as string),
        enabled: !!user && !!peanutWalletAddress,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const handleSuccess = useCallback(
        (amount: number, statusData?: DepositAddressStatusResponse) => {
            posthog.capture(ANALYTICS_EVENTS.DEPOSIT_COMPLETED, {
                amount,
                chain_type: network,
                method_type: 'crypto',
            })
            setDepositResult(statusData ?? { status: 'completed', amount })
            setShowSuccessView(true)
        },
        [network]
    )

    if (showSuccessView && depositResult) {
        return (
            <PaymentSuccessView
                type="DEPOSIT"
                headerTitle="Deposited Crypto"
                usdAmount={depositResult.amount?.toString()}
                amount={depositResult.tokenAmount}
                redirectTo="/add-money"
                onComplete={() => {
                    setShowSuccessView(false)
                    setDepositResult(null)
                }}
            />
        )
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
