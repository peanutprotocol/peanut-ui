'use client'

import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import { useContributePotFlow } from '../useContributePotFlow'
import { useCallback, useState } from 'react'
import type { RhinoChainType } from '@/services/services.types'
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useFlowExit } from '@/features/payments/shared/hooks/useFlowExit'
import { contributedAmount, isPartialContribution } from '@/utils/request-pot.utils'
import { useTranslations } from 'next-intl'

const ExternalWalletPaymentView = () => {
    const t = useTranslations('payment')
    const {
        charge,
        setCurrentView,
        completeExternalWalletPayment,
        resetContributePotFlow,
        amount,
        request,
        // true while the bridged deposit waits for the API to book it
        isLoading: isConfirmingPayment,
    } = useContributePotFlow()
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

    // The deposit arrived short of the charge (TASK-23856). The card stays and
    // states what arrived and what is still needed: a second transfer to the
    // same address books on the same charge, and the card watches for it.
    const shortDeposit =
        charge && isPartialContribution(charge)
            ? { received: contributedAmount(charge), asked: charge.tokenAmount }
            : undefined
    // the success screen's exit, for a payer who stops after the short deposit
    const leaveFlow = useFlowExit('/home', resetContributePotFlow)

    const onSuccess = useCallback(() => {
        void completeExternalWalletPayment()
    }, [completeExternalWalletPayment])

    return (
        <div className="flex flex-col gap-4">
            <RhinoDepositView
                showUserCard
                headerTitle={t('headers.pay')}
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
                tokenAmount={charge ? `${charge.tokenAmount} ${charge.tokenSymbol}` : undefined}
                isConfirming={isConfirmingPayment}
                shortDeposit={shortDeposit}
                onDone={shortDeposit ? leaveFlow : undefined}
            />
        </div>
    )
}

export default ExternalWalletPaymentView
