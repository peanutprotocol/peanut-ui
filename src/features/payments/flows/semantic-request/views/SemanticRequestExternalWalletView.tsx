import { useCallback, useState } from 'react'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useQuery } from '@tanstack/react-query'
import { rhinoApi } from '@/services/rhino'
import RhinoDepositView from '@/components/AddMoney/views/RhinoDeposit.view'
import type { RhinoChainType } from '@/services/services.types'
import { useTranslations } from 'next-intl'
import { isStableCoin } from '@/utils/general.utils'

const SemanticRequestExternalWalletView = () => {
    const t = useTranslations('payment')
    const {
        charge,
        setCurrentView,
        completeExternalWalletPayment,
        amount,
        // true while the bridged deposit waits for the API to book it
        isLoading: isConfirmingPayment,
    } = useSemanticRequestFlow()
    const [chainType, setChainType] = useState<RhinoChainType>('EVM')
    const { address: peanutWalletAddress } = useWallet()

    const { data: depositAddressData, isLoading } = useQuery({
        queryKey: ['rhino-deposit-address', charge?.uuid, chainType],
        queryFn: () => {
            if (!charge?.uuid) {
                throw new Error('Charge ID is required')
            }
            return rhinoApi.createRequestFulfilmentAddress(chainType, charge?.uuid as string, peanutWalletAddress)
        },
        enabled: !!charge,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
    })

    const onSuccess = useCallback(() => {
        void completeExternalWalletPayment()
    }, [completeExternalWalletPayment])

    return (
        <RhinoDepositView
            headerTitle={t('headers.pay')}
            chainType={chainType}
            setChainType={setChainType}
            depositAddressData={depositAddressData}
            isDepositAddressDataLoading={isLoading}
            onSuccess={onSuccess}
            onBack={() => setCurrentView('INITIAL')}
            showUserCard
            isConfirming={isConfirmingPayment}
            amount={Number(amount)}
            // a dollar stablecoin's amount is the dollar figure on the card; another
            // token's would need its own wording, so it shows none
            tokenAmount={
                charge?.tokenAmount && isStableCoin(charge.tokenSymbol)
                    ? `${charge.tokenAmount} ${charge.tokenSymbol}`
                    : undefined
            }
            identifier={
                charge?.requestLink.recipientAccount.type === 'peanut-wallet'
                    ? charge?.requestLink.recipientAccount.user.username
                    : charge?.requestLink.recipientAccount.identifier
            }
        />
    )
}

export default SemanticRequestExternalWalletView
