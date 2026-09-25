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
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import SupportCTA from '@/components/Global/SupportCTA'
import { useContributePotFlow } from '../useContributePotFlow'
import { useState } from 'react'
import { useAuth } from '@/context/authContext'
import { RequestPotActionList } from '../components/RequestPotActionList'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { formatBankAmount } from '@/utils/currency'

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
        balanceFillAmount,
        canProceed,
        hasSufficientBalance,
        isInsufficientBalance,
        isLoggedIn,
        isLoading,
        totalAmount,
        totalCollected,
        remainingAmount,
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

    const askedCurrency = request?.currency?.toUpperCase()
    const askedValue = Number(request?.requestedAmount)
    const askedAmount =
        askedCurrency && askedCurrency !== 'USD' && askedValue > 0
            ? formatBankAmount(askedValue, askedCurrency)
            : undefined

    // determine button state
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    return (
        <div className="flex min-h-inherit flex-col justify-between gap-8">
            <NavHeader onPrev={onBack} title={t('headers.pay')} />

            <PageStack.Center className="gap-4">
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
                        avatarKey={recipient.avatarKey}
                    />
                )}

                {/* A request asked in another currency leads with what it asks for.
                    The card above and the field below are in dollars, because that
                    is what Peanut settles in; without this line the asked amount
                    only showed in a grey note under the payment methods. */}
                {askedAmount && (
                    <TitleBlock
                        size="s"
                        align="center"
                        title={t('requestAsksFor', { amount: askedAmount })}
                        description={t('requestAsksForDollars', { amount: formatBankAmount(totalAmount, 'USD') })}
                        data-testid="request-asked-amount"
                    />
                )}

                {/* amount input with slider + its field error form one column, 4px apart */}
                <div className="flex flex-col gap-1">
                    <AmountInput
                        initialAmount={amount}
                        setPrimaryAmount={setAmount}
                        onSubmit={handlePayWithPeanut}
                        walletBalance={isLoggedIn ? formattedBalance : undefined}
                        balanceFillAmount={isLoggedIn ? balanceFillAmount : undefined}
                        hideBalance={!isLoggedIn}
                        hideCurrencyToggle={true}
                        showSlider={remainingAmount > 0}
                        maxAmount={remainingAmount}
                        defaultSliderValue={sliderDefaults.percentage}
                        defaultSliderSuggestedAmount={sliderDefaults.suggestedAmount}
                    />
                    {isInsufficientBalance && <FieldError>{t('errors.insufficientRequest')}</FieldError>}
                </div>

                {/* error display */}
                {error.showError && <Callout priority="error">{error.errorMessage}</Callout>}

                {/* payment options */}
                <RequestPotActionList
                    isAmountEntered={isAmountEntered}
                    usdAmount={amount}
                    recipientUserId={recipient?.userId}
                    recipientUsername={recipient?.username}
                    recipientAvatarKey={recipient?.avatarKey}
                    requestMessage={request?.reference || ''}
                    requestId={request?.uuid}
                    bankPayable={!!request?.bankInstructionsShared}
                    remainingUsd={totalAmount > 0 ? remainingAmount : undefined}
                    requestTokenSymbol={request?.tokenSymbol}
                    requestCurrency={request?.currency}
                    onPayWithPeanut={handlePayWithPeanut}
                    isPaymentLoading={isLoading && !isExternalWalletLoading}
                    isExternalWalletLoading={isExternalWalletLoading}
                    onPayWithExternalWallet={handleOpenExternalWalletFlow}
                />
            </PageStack.Center>

            {/* support cta */}
            {!isFetchingUser && <SupportCTA />}
        </div>
    )
}
