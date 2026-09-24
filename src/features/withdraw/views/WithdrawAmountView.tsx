'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import AmountInput from '@/components/Global/AmountInput'
import NavHeader from '@/components/Global/NavHeader'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { type useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import { shouldShowAmountError } from '@/features/limits/amount-error-gating'
import { type FlowErrorState } from '@/interfaces/interfaces'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'

interface WithdrawAmountViewProps {
    pageTitle: string
    heading: string
    initialAmount: string
    walletBalance: string
    /** Full-precision spendable balance — tapping the balance row fills the field with it (floored to cents). */
    balanceFillAmount: number
    onBalanceFilled: (value: string) => void
    onAmountChange: (value: string | undefined) => void
    onBack: () => void
    onContinue: () => void
    continueDisabled: boolean
    isLoading?: boolean
    error: FlowErrorState
    isCryptoWithdraw: boolean
    limitsValidation?: ReturnType<typeof useLimitsValidation>
    /**
     * Set for a bank account paid in EUR, GBP, MXN or COP (TASK-23054): the field
     * takes the bank amount in that currency, and `onAmountChange` gets
     * the USD it converts to — the Manteca amount pattern.
     */
    bankAmount?: {
        /** ISO code shown in the field, e.g. 'EUR'. */
        currency: string
        /** Destination units per 1 USD, fees included. */
        rate: number
        initialAmount: string
        /** 'USD' when a USD amount was carried in: the field opens on USD, toggleable. */
        initialDenomination?: string
        onAmountChange: (value: string) => void
    }
}

/** Amount step of the withdraw flow — dumb view, state lives in the flow hook + URL. */
export const WithdrawAmountView: FC<WithdrawAmountViewProps> = ({
    pageTitle,
    heading,
    initialAmount,
    walletBalance,
    balanceFillAmount,
    onBalanceFilled,
    onAmountChange,
    onBack,
    onContinue,
    continueDisabled,
    isLoading = false,
    error,
    isCryptoWithdraw,
    limitsValidation,
    bankAmount,
}) => {
    const tCommon = useTranslations('common')

    // only show limits card for bank/manteca withdrawals, not crypto
    const showLimitsCard = !isCryptoWithdraw && (limitsValidation?.isBlocking || limitsValidation?.isWarning)
    const limitsCardProps =
        showLimitsCard && limitsValidation
            ? getLimitsWarningCardProps({ validation: limitsValidation, flowType: 'offramp', currency: 'USD' })
            : null

    return (
        <PageStack>
            <NavHeader title={pageTitle} onPrev={onBack} />
            <PageStack.Center className="gap-4">
                <div className="text-heading-xs text-foreground-primary">{heading}</div>
                {bankAmount ? (
                    <AmountInput
                        initialAmount={bankAmount.initialAmount}
                        initialDenomination={bankAmount.initialDenomination}
                        setPrimaryAmount={bankAmount.onAmountChange}
                        setSecondaryAmount={onAmountChange}
                        primaryDenomination={{ symbol: bankAmount.currency, price: bankAmount.rate, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                        walletBalance={walletBalance}
                        // the balance row is USD and the field is the bank currency:
                        // floor the USD to cents first so the fill never quotes above it
                        balanceFillAmount={(Math.floor(balanceFillAmount * 100) / 100) * bankAmount.rate}
                        onBalanceFilled={onBalanceFilled}
                    />
                ) : (
                    <AmountInput
                        initialAmount={initialAmount}
                        setPrimaryAmount={onAmountChange}
                        primaryDenomination={{
                            symbol: '$',
                            price: 1,
                            decimals: 6, // we want USDC decimals to be able to pay exactly
                        }}
                        walletBalance={walletBalance}
                        balanceFillAmount={balanceFillAmount}
                        onBalanceFilled={onBalanceFilled}
                        hideCurrencyToggle
                    />
                )}

                {limitsCardProps && <LimitsWarningCard {...limitsCardProps} />}

                <Button
                    variant="primary"
                    shadowSize="4"
                    onClick={onContinue}
                    disabled={continueDisabled}
                    loading={isLoading}
                    className="w-full"
                >
                    {tCommon('continue')}
                </Button>
                {/* the banner yields to the limits card only when that card renders (TASK-21666) */}
                {shouldShowAmountError({
                    showError: error.showError && !!error.errorMessage,
                    showsLimitsCard: !isCryptoWithdraw,
                    limitsBlocking: limitsValidation?.isBlocking ?? false,
                }) && (
                    <Callout priority="error" data-testid="error-alert">
                        {error.errorMessage}
                    </Callout>
                )}
            </PageStack.Center>
        </PageStack>
    )
}
