'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import AmountInput from '@/components/Global/AmountInput'
import Badge from '@/components/Global/Badges/Badge'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import { type useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import { shouldShowAmountError } from '@/features/limits/amount-error-gating'
import { type FlowErrorState } from '@/interfaces/interfaces'
import { PaymentInfoRow } from '@/components/Payment/PaymentInfoRow'
import { type WithdrawFeeEstimate } from '@/features/withdraw/useWithdrawFeeEstimate'
import { formatNumberForDisplay, isStableCoin } from '@/utils/general.utils'
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
        /** 'USD' when the user had toggled the field to USD; `initialAmount` is then the USD. */
        initialDenomination: string
        onAmountChange: (value: string) => void
        /** The field's currency toggle: 'USD' when the user types the USD amount instead. */
        onDenominationChange: (symbol: string) => void
    }
    /**
     * Crypto withdraw only: the network fee estimate for the typed amount and
     * the chosen destination. The confirm screen still shows the final quote.
     */
    feeEstimate?: WithdrawFeeEstimate
    /** the destination token, for the "Recipient receives" line */
    receiveTokenSymbol?: string
    /** USD the withdrawal really moves (a max withdrawal keeps the sub-cent remainder); defaults to the typed amount */
    resolvedAmountUsd?: string
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
    feeEstimate,
    receiveTokenSymbol = 'USDC',
    resolvedAmountUsd,
}) => {
    const tCommon = useTranslations('common')
    const t = useTranslations('withdraw')
    const tGlobal = useTranslations('global')

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
                        setCurrentDenomination={bankAmount.onDenominationChange}
                        primaryDenomination={{ symbol: bankAmount.currency, price: bankAmount.rate, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                        // the quote rounds the USDC up to the cent; the line and the balance check match it
                        roundSecondaryUp
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

                {feeEstimate && feeEstimate.status !== 'idle' && (
                    <FeeEstimateCard
                        estimate={feeEstimate}
                        amountUsd={resolvedAmountUsd ?? initialAmount}
                        tokenSymbol={receiveTokenSymbol}
                        labels={{
                            networkFee: t('confirm.networkFee'),
                            estimatedNetworkFee: t('confirm.estimatedNetworkFee'),
                            recipientReceives: t('confirm.recipientReceives'),
                            noFee: tGlobal('tokenSelector.noFee'),
                        }}
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

/**
 * The ConfirmWithdrawView / NetworkFeeRow recipe: two PaymentInfoRows in one
 * Card. A free route says "No fee"; anything else is an estimate ("~", "≈")
 * until the confirm screen's final quote. Unknown is a dash, never zero.
 */
const FeeEstimateCard: FC<{
    estimate: Exclude<WithdrawFeeEstimate, { status: 'idle' }>
    amountUsd: string
    tokenSymbol: string
    labels: { networkFee: string; estimatedNetworkFee: string; recipientReceives: string; noFee: string }
}> = ({ estimate, amountUsd, tokenSymbol, labels }) => {
    const loading = estimate.status === 'loading'
    const isFree = estimate.status === 'free'
    // `custom`: "No fee" is a benefit, not a status — the selector's accent pill
    const noFee = <Badge status="custom" customText={labels.noFee} />

    let fee: React.ReactNode = '—'
    let receive: React.ReactNode = '—'
    if (isFree) {
        fee = noFee
        receive = `$${formatNumberForDisplay(amountUsd, { maxDecimals: 6 })}`
    } else if (estimate.status === 'ready') {
        // the quote's fee verbatim; a sub-cent fee is not rounded to a misleading "~$0.00"
        fee = estimate.feeUsd > 0 && estimate.feeUsd < 0.01 ? '< $0.01' : `~$${Math.max(0, estimate.feeUsd).toFixed(2)}`
        receive = isStableCoin(tokenSymbol)
            ? `≈ $${Number(estimate.receiveAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
            : `≈ ${formatNumberForDisplay(estimate.receiveAmount, { maxDecimals: 6 })} ${tokenSymbol}`
    }

    return (
        <Card className="w-full rounded-sm" data-testid="withdraw-fee-estimate">
            <PaymentInfoRow
                label={isFree ? labels.networkFee : labels.estimatedNetworkFee}
                value={fee}
                loading={loading}
            />
            <PaymentInfoRow hideBottomBorder label={labels.recipientReceives} value={receive} loading={loading} />
        </Card>
    )
}
