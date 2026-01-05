'use client'

import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { useContributePotFlow } from '../useContributePotFlow'
import { useCallback, useState } from 'react'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import { useWallet } from '@/hooks/wallet/useWallet'

const ExternalWalletPaymentView = () => {
    const { charge, setCurrentView, setIsExternalWalletPayment, amount, request } = useContributePotFlow()
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
            return rhinoApi.createRequestFulfilmentAddress(chainType, charge?.uuid as string, peanutWalletAddress)
        },
        enabled: !!charge,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const onSuccess = useCallback((_: number) => {
        setIsExternalWalletPayment(true)
        setCurrentView('STATUS')
    }, [])

    return (
        <div className="flex flex-col gap-4">
            <RhinoDepositView
                showUserCard
                headerTitle="Pay"
                chainType={chainType}
                setChainType={setChainType}
                depositAddressData={depositAddressData}
                isDepositAddressDataLoading={isLoading}
                onSuccess={onSuccess}
                onBack={() => setCurrentView('INITIAL')}
                identifier={
                    request?.recipientAccount.type === 'peanut-wallet'
                        ? request?.recipientAccount.user.username
                        : request?.recipientAccount.identifier
                }
                amount={Number(amount)}
            />
        </div>
    )
}

export default ExternalWalletPaymentView
