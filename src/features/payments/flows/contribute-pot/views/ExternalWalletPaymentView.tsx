'use client'

import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { useContributePotFlow } from '../useContributePotFlow'
import { useState } from 'react'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import { useWallet } from '@/hooks/wallet/useWallet'

const ExternalWalletPaymentView = () => {
    const { charge, setCurrentView, setIsExternalWalletPayment } = useContributePotFlow()
    const [chainType, setChainType] = useState<RhinoChainType>('EVM')
    const { address: peanutWalletAddress } = useWallet()

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', charge?.uuid, chainType],
        queryFn: () => {
            if (!charge?.requestLink.uuid) {
                throw new Error('Request ID is required')
            }
            if (!charge.uuid) {
                throw new Error('Charge ID is required')
            }
            return rhinoApi.createRequestFulfilmentAddress(
                charge?.requestLink.uuid,
                chainType,
                charge?.uuid as string,
                peanutWalletAddress
            )
        },
        enabled: !!charge,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    return (
        <RhinoDepositView
            headerTitle="Pay"
            chainType={chainType}
            setChainType={setChainType}
            depositAddressData={depositAddressData}
            isDepositAddressDataLoading={isLoading}
            onSuccess={(_) => {
                setIsExternalWalletPayment(true)
                setCurrentView('STATUS')
            }}
        />
    )
}

export default ExternalWalletPaymentView
