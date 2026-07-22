'use client'

/**
 * input view for contribute pot flow
 *
 * displays:
 * - recipient card with pot progress (amount collected / total)
 * - amount input with slider (defaults to smart suggestion)
 * - payment method options
 * - contributors drawer (see who else paid)
 *
 * executes payment directly on submit
 */

import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import ErrorAlert from '@/components/Global/ErrorAlert'
import SupportCTA from '@/components/Global/SupportCTA'
import { useContributePotFlow } from '../useContributePotFlow'
import { useState } from 'react'
import { useAuth } from '@/context/authContext'
import { RequestPotActionList } from '../components/RequestPotActionList'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'

export function ContributePotInputView() {
    const onBack = useSafeBack('/')
    const t = useTranslations('payment')
    const { isFetchingUser } = useAuth()
    const {
        amount,
        request,
        recipient,
        error,
        formattedBalance,
        canProceed,
        hasSufficientBalance,
        isInsufficientBalance,
        isLoggedIn,
        isLoading,
        totalAmount,
        totalCollected,
        contributors,
        sliderDefaults,
        setAmount,
        executeContribution,
        setCurrentView,
    } = useContributePotFlow()

    // handle submit - directly execute contribution
    const handlePayWithPeanut = () => {
        if (canProceed && hasSufficientBalance && !isLoading) {
            executeContribution()
        }
    }

    // handle External Wallet click
    const [isExternalWalletLoading, setIsExternalWalletLoading] = useState(false)
    const handleOpenExternalWalletFlow = async () => {
        if (canProceed && !isLoading) {
            setIsExternalWalletLoading(true)
            try {
                const res = await executeContribution(true, true) // return after creating charge
                // proceed only if charge is created successfully
                if (res && res.success) {
                    setCurrentView('EXTERNAL_WALLET')
                }
            } finally {
                setIsExternalWalletLoading(false)
            }
        }
    }

    // determine button state
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={onBack} title={t('headers.pay')} />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* recipient card with pot info */}
                {recipient && (
                    <UserCard
                        type="request_pay"
                        username={recipient.username}
                        recipientType="USERNAME"
                        isVerified={!!recipient.userId}
                        message={request?.reference || ''}
                        fileUrl={request?.attachmentUrl || ''}
                        amount={totalAmount}
                        amountCollected={totalCollected}
                        isRequestPot={true}
                        contributors={contributors}
                    />
                )}

                {/* amount input with slider */}
                <AmountInput
                    initialAmount={amount}
                    setPrimaryAmount={setAmount}
                    onSubmit={handlePayWithPeanut}
                    walletBalance={isLoggedIn ? formattedBalance : undefined}
                    hideBalance={!isLoggedIn}
                    hideCurrencyToggle={true}
                    showSlider={totalAmount > 0}
                    maxAmount={totalAmount}
                    amountCollected={totalCollected}
                    defaultSliderValue={sliderDefaults.percentage}
                    defaultSliderSuggestedAmount={sliderDefaults.suggestedAmount}
                />

                {/* error display */}
                {isInsufficientBalance && <ErrorAlert description={t('errors.insufficientRequest')} />}
                {error.showError && <ErrorAlert description={error.errorMessage} />}

                {/* payment options */}
                <RequestPotActionList
                    isAmountEntered={isAmountEntered}
                    usdAmount={amount}
                    recipientUserId={recipient?.userId}
                    recipientUsername={recipient?.username}
                    onPayWithPeanut={handlePayWithPeanut}
                    isPaymentLoading={isLoading && !isExternalWalletLoading}
                    isExternalWalletLoading={isExternalWalletLoading}
                    onPayWithExternalWallet={handleOpenExternalWalletFlow}
                />
            </div>

            {/* support cta */}
            {!isFetchingUser && <SupportCTA />}
        </div>
    )
}
