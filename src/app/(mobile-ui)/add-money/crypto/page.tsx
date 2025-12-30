'use client'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { useAuth } from '@/context/authContext'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rhinoApi } from '@/services/rhino'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

interface AddMoneyCryptoPageProps {
    headerTitle?: string
    onBack?: () => void
    depositAddress?: string
}

const AddMoneyCryptoPage = ({ headerTitle, onBack, depositAddress }: AddMoneyCryptoPageProps) => {
    const { user } = useAuth()
    const { address: peanutWalletAddress } = useWallet()
    const [chainType, setChainType] = useState<RhinoChainType>('EVM')
    const [showSuccessView, setShowSuccessView] = useState(false)
    const [depositedAmount, setDepositedAmount] = useState(0)

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', user?.user.userId, chainType],
        queryFn: () =>
            rhinoApi.createDepositAddress(peanutWalletAddress as string, chainType, user?.user.userId as string),
        enabled: !!user && !!peanutWalletAddress,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const handleSuccess = (amount: number) => {
        setDepositedAmount(amount)
        setShowSuccessView(true)
    }

    if (showSuccessView) {
        return <PaymentSuccessView type="DEPOSIT" amount={depositedAmount.toString()} />
    }

    return (
        <RhinoDepositView
            headerTitle="Add Money"
            onBack={onBack}
            chainType={chainType}
            depositAddressData={depositAddressData}
            isDepositAddressDataLoading={isLoading}
            setChainType={setChainType}
            onSuccess={handleSuccess}
        />
    )
}

export default AddMoneyCryptoPage
