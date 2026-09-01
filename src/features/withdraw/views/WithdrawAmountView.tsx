'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import AmountInput from '@/components/Global/AmountInput'
import NavHeader from '@/components/Global/NavHeader'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { type useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import { shouldShowAmountError } from '@/features/withdraw/amount-gating'
import { type FlowErrorState } from '@/features/withdraw/types'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'

interface WithdrawAmountViewProps {
    pageTitle: string
    heading: string
    initialAmount: string
    walletBalance: string
    onAmountChange: (value: string | undefined) => void
    onBack: () => void
    onContinue: () => void
    continueDisabled: boolean
    error: FlowErrorState
    isCryptoWithdraw: boolean
    limitsValidation: ReturnType<typeof useLimitsValidation>
}

/** Amount step of the withdraw flow — dumb view, state lives in the flow hook + URL. */
export const WithdrawAmountView: FC<WithdrawAmountViewProps> = ({
    pageTitle,
    heading,
    initialAmount,
    walletBalance,
    onAmountChange,
    onBack,
    onContinue,
    continueDisabled,
    error,
    isCryptoWithdraw,
    limitsValidation,
}) => {
    const tCommon = useTranslations('common')

    // only show limits card for bank/manteca withdrawals, not crypto
    const showLimitsCard = !isCryptoWithdraw && (limitsValidation.isBlocking || limitsValidation.isWarning)
    const limitsCardProps = showLimitsCard
        ? getLimitsWarningCardProps({ validation: limitsValidation, flowType: 'offramp', currency: 'USD' })
        : null

    return (
        <PageStack>
            <NavHeader title={pageTitle} onPrev={onBack} />
            <PageStack.Center className="gap-4">
                <div className="text-heading-xs text-foreground-primary">{heading}</div>
                <AmountInput
                    initialAmount={initialAmount}
                    setPrimaryAmount={onAmountChange}
                    primaryDenomination={{
                        symbol: '$',
                        price: 1,
                        decimals: 6, // we want USDC decimals to be able to pay exactly
                    }}
                    walletBalance={walletBalance}
                    hideCurrencyToggle
                />

                {limitsCardProps && <LimitsWarningCard {...limitsCardProps} />}

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onContinue}
                    disabled={continueDisabled}
                    className="w-full"
                >
                    {tCommon('continue')}
                </Button>
                {/* the banner yields to the limits card only when that card renders (TASK-21666) */}
                {shouldShowAmountError({
                    showError: error.showError && !!error.errorMessage,
                    isCryptoWithdraw,
                    limitsBlocking: limitsValidation.isBlocking,
                }) && (
                    <Notification priority="error" data-testid="error-alert">
                        {error.errorMessage}
                    </Notification>
                )}
            </PageStack.Center>
        </PageStack>
    )
}
