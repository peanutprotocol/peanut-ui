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
    /** Full-precision spendable balance, in USD — tapping the balance row fills the field with it (floored to cents). */
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
     * Destination currency (e.g. 'EUR', 'GBP', 'MXN'). When set and not
     * 'USD', the amount is typed in this currency first — USD (the amount
     * actually sent) shows as the converted secondary line, same pattern as
     * the Manteca amount step (QA-49: asking in USD for a EUR/GBP/MXN
     * destination). Omit (or 'USD') to keep the plain USD-only input used
     * for crypto and US bank withdrawals.
     */
    destinationCurrency?: string
    /** Local-currency units per 1 USD (Bridge's `sell_rate`). Required to show the currency-first input; null while it loads. */
    destinationRate?: string | null
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
    destinationCurrency,
    destinationRate,
}) => {
    const tCommon = useTranslations('common')

    // only show limits card for bank/manteca withdrawals, not crypto
    const showLimitsCard = !isCryptoWithdraw && (limitsValidation?.isBlocking || limitsValidation?.isWarning)
    const limitsCardProps =
        showLimitsCard && limitsValidation
            ? getLimitsWarningCardProps({ validation: limitsValidation, flowType: 'offramp', currency: 'USD' })
            : null

    // local-currency-first for a Bridge destination with real FX (EUR/GBP/MXN/COP —
    // QA-49). `rate` is local-currency units per 1 USD, same convention the
    // Manteca amount step uses for `currencyPrice.sell`.
    const rate = destinationRate ? parseFloat(destinationRate) : null
    const showDestinationCurrencyFirst = !!destinationCurrency && destinationCurrency !== 'USD' && !!rate

    return (
        <PageStack>
            <NavHeader title={pageTitle} onPrev={onBack} />
            <PageStack.Center className="gap-4">
                <div className="text-heading-xs text-foreground-primary">{heading}</div>
                {showDestinationCurrencyFirst ? (
                    <AmountInput
                        initialAmount={initialAmount}
                        // initialAmount (rawTokenAmount) is always USD — tag a
                        // pre-filled amount (back-nav, deep link) as such so it
                        // isn't misread as an EUR/GBP/MXN figure. A blank field
                        // opens in the destination currency (primary), which is
                        // the point of this branch — omit the override then.
                        initialDenomination={initialAmount ? 'USD' : undefined}
                        // the field the user types is the destination currency; the
                        // USD amount actually sent is the derived (secondary) value
                        setPrimaryAmount={() => {}}
                        setSecondaryAmount={onAmountChange}
                        primaryDenomination={{ symbol: destinationCurrency!, price: rate!, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                        walletBalance={walletBalance}
                        // balanceFillAmount is denominated in the primary unit —
                        // convert the USD spendable balance to the destination currency
                        balanceFillAmount={balanceFillAmount * rate!}
                        // note: fillValue arrives in the destination currency here,
                        // while every other onAmountChange tick is USD — the
                        // "was this a balance tap" ref in useWithdrawRootFlow won't
                        // latch for this path. No consumer reads isMaxWithdrawal for
                        // bridge/bank withdrawals today (only /withdraw/crypto does).
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
