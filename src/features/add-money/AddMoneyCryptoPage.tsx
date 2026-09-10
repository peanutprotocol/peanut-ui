'use client'

import ChooseNetworkView from '@/components/AddMoney/views/ChooseNetwork.view'
import CryptoDepositView from '@/components/AddMoney/views/CryptoDeposit.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { useTranslations } from 'next-intl'
import { useAddMoneyCryptoFlow } from './useAddMoneyCryptoFlow'

export function AddMoneyCryptoPage() {
    const t = useTranslations('addMoney')
    const {
        needsNetworkChoice,
        network,
        setNetworkParam,
        onBack,
        showSuccessView,
        depositResult,
        depositTransactionDetails,
        depositAddressData,
        isLoading,
        isError,
        refetch,
        handleSuccess,
        handleSuccessComplete,
    } = useAddMoneyCryptoFlow()

    if (needsNetworkChoice && !showSuccessView) {
        return (
            <ChooseNetworkView
                // push so browser back returns from the deposit view to this step
                onSelect={(value) => setNetworkParam(value, { history: 'push' })}
                onBack={onBack}
            />
        )
    }

    if (showSuccessView && depositResult) {
        return (
            <PaymentSuccessView
                type="DEPOSIT"
                headerTitle={t('crypto.depositedCrypto')}
                usdAmount={depositResult.amount?.toString()}
                amount={depositResult.tokenAmount}
                transactionDetails={depositTransactionDetails}
                replaceOnDone
                onComplete={handleSuccessComplete}
            />
        )
    }

    return (
        <CryptoDepositView
            network={network}
            depositAddressData={depositAddressData}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onSuccess={handleSuccess}
            onBack={onBack}
        />
    )
}
