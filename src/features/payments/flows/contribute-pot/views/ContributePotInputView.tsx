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
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import ErrorAlert from '@/components/Global/ErrorAlert'
import SupportCTA from '@/components/Global/SupportCTA'
import { useContributePotFlow } from '../useContributePotFlow'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { RequestPotActionList } from '../components/RequestPotActionList'

export function ContributePotInputView() {
    const router = useRouter()
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

    // handle back navigation
    const handleGoBack = () => {
        if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/')
        }
    }

    // handle External Wallet click
    const handleOpenExternalWalletFlow = async () => {
        if (canProceed && hasSufficientBalance && !isLoading) {
            const res = await executeContribution(true) // return after creating charge
            // Proceed only if charge is created successfully
            if (res && res.success) {
                setCurrentView('EXTERNAL_WALLET')
            }
        }
    }

    // determine button state
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={handleGoBack} title="Pay" />

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
                <TokenAmountInput
                    tokenValue={amount}
                    setTokenValue={(val) => setAmount(val ?? '')}
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
                {isInsufficientBalance && (
                    <ErrorAlert description="Not enough balance to fulfill this request with Peanut" />
                )}
                {error.showError && <ErrorAlert description={error.errorMessage} />}

                {/* payment options */}
                <RequestPotActionList
                    isAmountEntered={isAmountEntered}
                    usdAmount={amount}
                    recipientUserId={recipient?.userId}
                    onPayWithPeanut={handlePayWithPeanut}
                    isPaymentLoading={isLoading}
                    onPayWithExternalWallet={handleOpenExternalWalletFlow}
                />
            </div>

            {/* support cta */}
            {!isFetchingUser && <SupportCTA />}
        </div>
    )
}
